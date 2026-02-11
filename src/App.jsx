import React, { useState, useEffect } from 'react';
import { Upload, X, FileText, LogOut, Trash2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
// You'll replace these with your actual Supabase project credentials
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const NoteCycle = () => {
  // Auth state
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [viewingNotes, setViewingNotes] = useState(false);

  // App state
  const [selectedMajor, setSelectedMajor] = useState('All');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(true);

  // Upload form state
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadCourse, setUploadCourse] = useState('');
  const [uploadMajor, setUploadMajor] = useState('Biology');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  const majors = ['All', 'Biology', 'Chemistry', 'Economics', 'Computer Science & Engineering'];

  // Course options by major
  const coursesByMajor = {
    'Biology': ['BIS 2A', 'BIS 2B', 'BIS 2C', 'NPB 101', 'MCB 121L'],
    'Chemistry': ['CHE 2A', 'CHE 2B', 'CHE 2C', 'CHE 118A', 'CHE 128A'],
    'Economics': ['ECN 1A', 'ECN 1B', 'ECN 100', 'ECN 122', 'ECN 140'],
    'Computer Science & Engineering': ['ECS 36A', 'ECS 36B', 'ECS 36C', 'ECS 122A', 'ECS 154A']
  };

  // Check for existing session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch notes whenever user changes or component mounts
  useEffect(() => {
    fetchNotes();
  }, []);

  // Fetch all notes from Supabase
  const fetchNotes = async () => {
    try {
      setNotesLoading(true);
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setNotesLoading(false);
    }
  };

  // Auth functions
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        setShowAuthModal(false);
        setAuthEmail('');
        setAuthPassword('');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        setShowAuthModal(false);
        setAuthEmail('');
        setAuthPassword('');
      }
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSelectedMajor('All');
  };

  // Upload functions
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setUploadFile(file);
    } else {
      alert('Please select a PDF file');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!uploadTitle || !uploadCourse || !uploadFile || !user) {
      alert('Please fill in all required fields and ensure you are logged in');
      return;
    }

    setUploadLoading(true);

    try {
      // Upload file to Supabase Storage
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${uploadMajor}/${uploadCourse}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('notes-pdfs')
        .upload(filePath, uploadFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('notes-pdfs')
        .getPublicUrl(filePath);

      // Insert note record into database
      const { error: dbError } = await supabase
        .from('notes')
        .insert([
          {
            title: uploadTitle,
            description: uploadDescription,
            course: uploadCourse,
            major: uploadMajor,
            file_path: filePath,
            file_url: publicUrl,
            user_id: user.id,
            user_email: user.email
          }
        ]);

      if (dbError) throw dbError;

      // Refresh notes list
      await fetchNotes();

      // Reset form
      setShowUploadModal(false);
      setUploadTitle('');
      setUploadDescription('');
      setUploadCourse('');
      setUploadMajor('Biology');
      setUploadFile(null);
    } catch (error) {
      console.error('Error uploading note:', error);
      alert('Error uploading note: ' + error.message);
    } finally {
      setUploadLoading(false);
    }
  };

  // Delete note function
  const handleDeleteNote = async (note) => {
    if (!user || note.user_id !== user.id) {
      alert('You can only delete your own notes');
      return;
    }

    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      // Delete file from storage
      const { error: storageError } = await supabase.storage
        .from('notes-pdfs')
        .remove([note.file_path]);

      if (storageError) throw storageError;

      // Delete record from database
      const { error: dbError } = await supabase
        .from('notes')
        .delete()
        .eq('id', note.id);

      if (dbError) throw dbError;

      // Refresh notes list
      await fetchNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Error deleting note: ' + error.message);
    }
  };

  const filteredNotes = selectedMajor === 'All' 
    ? notes 
    : notes.filter(note => note.major === selectedMajor);

  // Landing page
  if (!user && !showAbout && !viewingNotes) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-indigo-900">NoteCycle</h1>
            <nav className="flex gap-8 items-center">
              <a href="#" onClick={(e) => { e.preventDefault(); setShowAbout(false); setViewingNotes(false); }} className="text-gray-700 hover:text-indigo-700 transition">Home</a>
              <a href="#" onClick={(e) => { e.preventDefault(); setShowAbout(true); }} className="text-gray-700 hover:text-indigo-700 transition">About</a>
              <a href="https://docs.google.com/forms/d/e/1FAIpQLSeRIGQNjFq_AZJg28FkUSHxkUHh6borkJJ2YfX1UeKy_hfNaA/viewform" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-indigo-700 transition">Contact</a>
              <a href="#" onClick={(e) => { e.preventDefault(); setViewingNotes(true); setShowAbout(false); }} className="text-gray-700 hover:text-indigo-700 transition">Notes</a>
              <button 
                onClick={(e) => { 
                  e.preventDefault();
                  setShowAuthModal(true); 
                  setIsSignUp(false); 
                }}
                className="bg-indigo-900 text-white px-6 py-2 rounded-lg hover:bg-white hover:text-indigo-900 border-2 border-indigo-900 transition"
              >
                Sign up/Login
              </button>
            </nav>
          </div>
        </header>

        {/* Hero Section */}
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-5xl font-bold text-indigo-900 mb-6">
                Note sharing<br />Simplified
              </h2>
              <p className="text-lg text-gray-700 mb-8 leading-relaxed">
                NoteCycle is a simple, student-first platform for sharing and accessing class notes. Easily upload your own notes or browse materials shared by others all organized by course and subject. Whether you're catching up or reviewing, NoteCycle helps you stay on track and support your campus community.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={(e) => { 
                    e.preventDefault();
                    setShowAuthModal(true); 
                    setIsSignUp(true); 
                  }}
                  className="bg-indigo-900 text-white px-8 py-3 rounded-lg hover:bg-white hover:text-indigo-900 border-2 border-indigo-900 transition font-medium"
                >
                  Sign up/Login
                </button>
                <button 
                  onClick={(e) => { e.preventDefault(); setShowAbout(true); }}
                  className="border-2 border-indigo-900 text-indigo-900 px-8 py-3 rounded-lg hover:bg-indigo-900 hover:text-white transition font-medium"
                >
                  Learn more
                </button>
              </div>
            </div>
            <div className="flex justify-center">
              <img 
                src="/mnt/user-data/uploads/1770075503432_logo_note_cycle.png"
                alt="Note sharing illustration"
                className="w-full max-w-lg"
              />
            </div>
          </div>
        </div>

        {/* Auth Modal */}
        {showAuthModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-indigo-900">
                  {isSignUp ? 'Sign Up' : 'Login'}
                </h3>
                <button onClick={() => { setShowAuthModal(false); setAuthError(''); }}>
                  <X className="w-6 h-6 text-gray-500 hover:text-gray-700" />
                </button>
              </div>
              <form onSubmit={handleAuth}>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                    disabled={authLoading}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Password</label>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                    disabled={authLoading}
                    minLength={6}
                  />
                </div>
                {authError && (
                  <div className="mb-4 text-red-600 text-sm">{authError}</div>
                )}
                <button
                  type="submit"
                  className="w-full bg-indigo-900 text-white py-2 rounded-lg hover:bg-indigo-800 transition mb-4 disabled:opacity-50"
                  disabled={authLoading}
                >
                  {authLoading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Login')}
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }}
                    className="text-indigo-900 hover:underline text-sm"
                    disabled={authLoading}
                  >
                    {isSignUp ? 'Already have an account? Login' : "Don't have an account? Sign up"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // About page
  if (showAbout) {
    return (
      <div className="min-h-screen bg-white">
        <header className="bg-white border-b border-gray-200 sticky top-0">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-indigo-900">NoteCycle</h1>
            <nav className="flex gap-8 items-center">
              <a href="#" onClick={(e) => { e.preventDefault(); setShowAbout(false); setViewingNotes(false); }} className="text-gray-700 hover:text-indigo-700 transition">Home</a>
              <a href="#" className="text-indigo-900 font-medium">About</a>
              <a href="https://docs.google.com/forms/d/e/1FAIpQLSeRIGQNjFq_AZJg28FkUSHxkUHh6borkJJ2YfX1UeKy_hfNaA/viewform" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-indigo-700 transition">Contact</a>
              <a href="#" onClick={(e) => { e.preventDefault(); setViewingNotes(true); setShowAbout(false); }} className="text-gray-700 hover:text-indigo-700 transition">Notes</a>
              <div className="flex items-center gap-3">
                {user ? (
                  <>
                    <span className="text-gray-700">{user.email}</span>
                    <button
                      onClick={handleLogout}
                      className="bg-indigo-900 text-white px-4 py-2 rounded-lg hover:bg-white hover:text-indigo-900 border-2 border-indigo-900 transition flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </>
                ) : (
                  <button
                    onClick={(e) => { 
                      e.preventDefault();
                      setShowAuthModal(true); 
                      setIsSignUp(false); 
                    }}
                    className="bg-indigo-900 text-white px-6 py-2 rounded-lg hover:bg-white hover:text-indigo-900 border-2 border-indigo-900 transition"
                  >
                    Sign up/Login
                  </button>
                )}
              </div>
            </nav>
          </div>
        </header>
        
        <div className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-4xl font-bold text-indigo-900 mb-8">About NoteCycle</h2>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 text-lg mb-6 leading-relaxed">
              NoteCycle is a student-first platform designed to revolutionize the way UC Davis students share and access class notes. We understand the challenges students face when trying to keep up with coursework, whether it's recovering from an illness, managing a demanding schedule, or simply wanting to review material from different perspectives.
            </p>
            
            <h3 className="text-2xl font-bold text-indigo-900 mt-8 mb-4">Our Mission</h3>
            <p className="text-gray-700 text-lg mb-6 leading-relaxed">
              Our mission is to create a collaborative learning environment where students can support each other's academic success. By providing a simple, organized platform for sharing class notes, we aim to foster a stronger sense of community on campus and ensure that quality educational resources are accessible to all students.
            </p>
            
            <h3 className="text-2xl font-bold text-indigo-900 mt-8 mb-4">How It Works</h3>
            <p className="text-gray-700 text-lg mb-4 leading-relaxed">
              NoteCycle makes it incredibly easy to share and find notes:
            </p>
            <ul className="text-gray-700 text-lg mb-6 leading-relaxed list-disc pl-8 space-y-2">
              <li><strong>Browse by Major:</strong> Find notes organized by your field of study - Biology, Chemistry, Economics, or Computer Science & Engineering.</li>
              <li><strong>Upload Your Notes:</strong> Share your own notes with the community by simply uploading PDF files and tagging them with the appropriate course code.</li>
              <li><strong>Access Anytime:</strong> All notes are available 24/7, so you can study on your own schedule.</li>
              <li><strong>Support Your Peers:</strong> Help your fellow students succeed by contributing your notes and perspectives.</li>
            </ul>
            
            <h3 className="text-2xl font-bold text-indigo-900 mt-8 mb-4">Why NoteCycle?</h3>
            <p className="text-gray-700 text-lg mb-6 leading-relaxed">
              We believe that education is better when students work together. NoteCycle eliminates the stress of finding reliable study materials and creates a culture of mutual support. Whether you're catching up after missing class, preparing for exams, or looking for alternative explanations of difficult concepts, NoteCycle has you covered.
            </p>
            
            <h3 className="text-2xl font-bold text-indigo-900 mt-8 mb-4">Join Our Community</h3>
            <p className="text-gray-700 text-lg mb-6 leading-relaxed">
              Ready to get started? Sign up today and become part of a growing community of UC Davis students who are committed to academic excellence and supporting one another. Together, we can make learning more accessible, collaborative, and successful for everyone.
            </p>
            
            <div className="mt-12 flex gap-4">
              <button 
                onClick={(e) => { 
                  e.preventDefault();
                  if (user) {
                    setShowAbout(false);
                  } else {
                    setShowAuthModal(true); 
                    setIsSignUp(true);
                  }
                }}
                className="bg-indigo-900 text-white px-8 py-3 rounded-lg hover:bg-white hover:text-indigo-900 border-2 border-indigo-900 transition font-medium"
              >
                {user ? 'Browse Notes' : 'Get Started'}
              </button>
              <a 
                href="https://docs.google.com/forms/d/e/1FAIpQLSeRIGQNjFq_AZJg28FkUSHxkUHh6borkJJ2YfX1UeKy_hfNaA/viewform"
                target="_blank"
                rel="noopener noreferrer"
                className="border-2 border-indigo-900 text-indigo-900 px-8 py-3 rounded-lg hover:bg-indigo-900 hover:text-white transition font-medium inline-block"
              >
                Contact Us
              </a>
            </div>
          </div>
        </div>

        {/* Auth Modal */}
        {showAuthModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-indigo-900">
                  {isSignUp ? 'Sign Up' : 'Login'}
                </h3>
                <button onClick={() => { setShowAuthModal(false); setAuthError(''); }}>
                  <X className="w-6 h-6 text-gray-500 hover:text-gray-700" />
                </button>
              </div>
              <form onSubmit={handleAuth}>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                    disabled={authLoading}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Password</label>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                    disabled={authLoading}
                    minLength={6}
                  />
                </div>
                {authError && (
                  <div className="mb-4 text-red-600 text-sm">{authError}</div>
                )}
                <button
                  type="submit"
                  className="w-full bg-indigo-900 text-white py-2 rounded-lg hover:bg-indigo-800 transition mb-4 disabled:opacity-50"
                  disabled={authLoading}
                >
                  {authLoading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Login')}
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }}
                    className="text-indigo-900 hover:underline text-sm"
                    disabled={authLoading}
                  >
                    {isSignUp ? 'Already have an account? Login' : "Don't have an account? Sign up"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main app (logged in or browsing)
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-900">NoteCycle</h1>
          <nav className="flex gap-8 items-center">
            <a href="#" onClick={(e) => { e.preventDefault(); setViewingNotes(false); setShowAbout(false); }} className="text-gray-700 hover:text-indigo-700 transition">Home</a>
            <a href="#" onClick={(e) => { e.preventDefault(); setShowAbout(true); }} className="text-gray-700 hover:text-indigo-700 transition">About</a>
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSeRIGQNjFq_AZJg28FkUSHxkUHh6borkJJ2YfX1UeKy_hfNaA/viewform" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-indigo-700 transition">Contact</a>
            <a href="#" className="text-indigo-900 font-medium">Notes</a>
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <span className="text-gray-700">{user.email}</span>
                  <button
                    onClick={handleLogout}
                    className="bg-indigo-900 text-white px-4 py-2 rounded-lg hover:bg-white hover:text-indigo-900 border-2 border-indigo-900 transition flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={(e) => { 
                    e.preventDefault();
                    setShowAuthModal(true); 
                    setIsSignUp(false); 
                  }}
                  className="bg-indigo-900 text-white px-6 py-2 rounded-lg hover:bg-white hover:text-indigo-900 border-2 border-indigo-900 transition"
                >
                  Sign up/Login
                </button>
              )}
            </div>
          </nav>
        </div>
      </header>

      <div className="flex max-w-7xl mx-auto">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-screen p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Majors</h2>
          <ul className="space-y-2">
            {majors.map((major) => (
              <li key={major}>
                <button
                  onClick={() => setSelectedMajor(major)}
                  className={`w-full text-left px-4 py-2 rounded-lg transition ${
                    selectedMajor === major
                      ? 'bg-indigo-900 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {major}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              {selectedMajor === 'All' ? 'All Notes' : `${selectedMajor} Notes`}
            </h2>
          </div>

          {/* Loading State */}
          {notesLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Loading notes...</p>
            </div>
          ) : (
            /* Notes Grid */
            <div className="grid grid-cols-4 gap-6">
              {filteredNotes.map((note) => (
                <div key={note.id} className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition relative group">
                  <a href={note.file_url} target="_blank" rel="noopener noreferrer">
                    <div className="aspect-[3/4] bg-gray-200 flex items-center justify-center">
                      <FileText className="w-20 h-20 text-gray-400" />
                    </div>
                  </a>
                  <div className="p-4">
                    <h3 className="font-medium text-gray-800 mb-1 truncate">{note.title}</h3>
                    <p className="text-sm text-indigo-900 font-medium">{note.course}</p>
                    {note.description && (
                      <p className="text-xs text-gray-600 mt-2 line-clamp-2">{note.description}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">By: {note.user_email}</p>
                  </div>
                  {user && note.user_id === user.id && (
                    <button
                      onClick={() => handleDeleteNote(note)}
                      className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition hover:bg-red-700"
                      title="Delete note"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              {/* Add Note Card */}
              <button
                onClick={() => {
                  if (user) {
                    setShowUploadModal(true);
                  } else {
                    setShowAuthModal(true);
                    setIsSignUp(true);
                  }
                }}
                className="aspect-[3/4] bg-gray-200 rounded-lg flex flex-col items-center justify-center hover:bg-gray-300 transition group"
              >
                <div className="w-16 h-16 rounded-full border-4 border-black flex items-center justify-center group-hover:scale-110 transition">
                  <span className="text-4xl text-black font-light">+</span>
                </div>
                <p className="mt-4 text-gray-700 font-medium">Add Note</p>
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-lg w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-indigo-900">Upload Note</h3>
              <button onClick={() => setShowUploadModal(false)}>
                <X className="w-6 h-6 text-gray-500 hover:text-gray-700" />
              </button>
            </div>
            <form onSubmit={handleUpload}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Title *</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                  disabled={uploadLoading}
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Description</label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                  disabled={uploadLoading}
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Major *</label>
                <select
                  value={uploadMajor}
                  onChange={(e) => {
                    setUploadMajor(e.target.value);
                    setUploadCourse('');
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                  disabled={uploadLoading}
                >
                  {majors.filter(m => m !== 'All').map((major) => (
                    <option key={major} value={major}>{major}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Course *</label>
                <select
                  value={uploadCourse}
                  onChange={(e) => setUploadCourse(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                  disabled={uploadLoading}
                >
                  <option value="">Select a course</option>
                  {coursesByMajor[uploadMajor]?.map((course) => (
                    <option key={course} value={course}>{course}</option>
                  ))}
                </select>
              </div>
              <div className="mb-6">
                <label className="block text-gray-700 mb-2">PDF File *</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                  disabled={uploadLoading}
                />
                {uploadFile && (
                  <p className="text-sm text-gray-600 mt-2">Selected: {uploadFile.name}</p>
                )}
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-900 text-white py-3 rounded-lg hover:bg-indigo-800 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                disabled={uploadLoading}
              >
                <Upload className="w-5 h-5" />
                {uploadLoading ? 'Uploading...' : 'Upload Note'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-indigo-900">
                {isSignUp ? 'Sign Up' : 'Login'}
              </h3>
              <button onClick={() => { setShowAuthModal(false); setAuthError(''); }}>
                <X className="w-6 h-6 text-gray-500 hover:text-gray-700" />
              </button>
            </div>
            <form onSubmit={handleAuth}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                  disabled={authLoading}
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                  disabled={authLoading}
                  minLength={6}
                />
              </div>
              {authError && (
                <div className="mb-4 text-red-600 text-sm">{authError}</div>
              )}
              <button
                type="submit"
                className="w-full bg-indigo-900 text-white py-2 rounded-lg hover:bg-indigo-800 transition mb-4 disabled:opacity-50"
                disabled={authLoading}
              >
                {authLoading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Login')}
              </button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }}
                  className="text-indigo-900 hover:underline text-sm"
                  disabled={authLoading}
                >
                  {isSignUp ? 'Already have an account? Login' : "Don't have an account? Sign up"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteCycle;