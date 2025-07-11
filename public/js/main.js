document.addEventListener('DOMContentLoaded', function () {
  const noteList = document.getElementById('note-list');
  const noteForm = document.getElementById('note-form');
  const noteTitle = document.getElementById('note-title');
  const noteContent = document.getElementById('note-content');
  const deleteBtn = document.getElementById('delete-btn');
  const newNoteBtn = document.getElementById('new-note-btn');
  
  // Session management - warn user if session is about to expire
  let sessionWarningShown = false;
  function checkSessionHealth() {
    fetch('/api/user-status')
      .then(res => res.json())
      .then(status => {
        if (!status.authenticated && !sessionWarningShown) {
          // User might have lost session, show subtle warning
          console.log('User session status:', status);
        }
      })
      .catch(err => {
        console.log('Session check failed:', err);
      });
  }
  
  // Check session health every 5 minutes
  setInterval(checkSessionHealth, 5 * 60 * 1000);
  
  // Online/Offline detection for auto-save
  let isOnline = navigator.onLine;
  let pendingChanges = false;
  
  function handleOnlineStatus() {
    isOnline = navigator.onLine;
    
    if (isOnline && pendingChanges) {
      console.log('Back online, saving pending changes...');
      showSaveIndicator('saving');
      setTimeout(() => {
        if (hasContentChanged()) {
          saveNote(true);
          pendingChanges = false;
        }
      }, 1000);
    } else if (!isOnline) {
      showSaveIndicator('offline');
      pendingChanges = true;
    }
  }
  
  window.addEventListener('online', handleOnlineStatus);
  window.addEventListener('offline', handleOnlineStatus);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (noteForm) {
        saveNote();
      }
    }
    
    // Ctrl/Cmd + N to create new note
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      if (newNoteBtn) {
        newNoteBtn.click();
      }
    }
    
    // Escape to clear focus
    if (e.key === 'Escape') {
      if (document.activeElement === noteTitle || document.activeElement === noteContent) {
        document.activeElement.blur();
      }
    }
  });

  // Select note with better error handling
  if (noteList) {
    noteList.addEventListener('click', function (e) {
      const li = e.target.closest('li[data-id]');
      if (li && li.dataset.id) {
        // Check if there are unsaved changes
        if (hasContentChanged()) {
          if (confirm('You have unsaved changes. Do you want to save before switching notes?')) {
            saveNote().then(() => {
              window.location = `/?note=${li.dataset.id}`;
            }).catch(() => {
              // If save fails, still switch notes
              window.location = `/?note=${li.dataset.id}`;
            });
          } else {
            // User chose not to save, switch notes anyway
            window.location = `/?note=${li.dataset.id}`;
          }
        } else {
          window.location = `/?note=${li.dataset.id}`;
        }
      }
    });
  }

  // Create new note with better UX
  if (newNoteBtn) {
    newNoteBtn.addEventListener('click', function () {
      // Check if there are unsaved changes
      if (hasContentChanged()) {
        if (confirm('You have unsaved changes. Do you want to save before creating a new note?')) {
          saveNote().then(() => {
            createNewNote();
          }).catch(() => {
            // If save fails, still create new note
            createNewNote();
          });
        } else {
          // User chose not to save, create new note anyway
          createNewNote();
        }
      } else {
        createNewNote();
      }
    });
  }
  
  function createNewNote() {
    // Show loading state
    newNoteBtn.disabled = true;
    newNoteBtn.textContent = '⏳';
    
    fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled', content: '' })
    })
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to create note');
        }
        return res.json();
      })
      .then(note => {
        window.location = `/?note=${note.id}`;
      })
      .catch(err => {
        console.error('Error creating note:', err);
        showSaveIndicator('error');
        // Reset button state
        newNoteBtn.disabled = false;
        newNoteBtn.textContent = '📝';
        alert('Failed to create note. Please try again.');
      });
  }

  // Enhanced auto-save functionality
  let saveTimeout;
  let lastSavedContent = '';
  let lastSavedTitle = '';
  let isAutoSaving = false;
  
  function hasContentChanged() {
    const currentTitle = noteTitle ? noteTitle.value : '';
    const currentContent = noteContent ? noteContent.value : '';
    return currentTitle !== lastSavedTitle || currentContent !== lastSavedContent;
  }
  
  function updateLastSavedState() {
    lastSavedTitle = noteTitle ? noteTitle.value : '';
    lastSavedContent = noteContent ? noteContent.value : '';
  }
  
  function autoSave() {
    clearTimeout(saveTimeout);
    
    // Only auto-save if content has actually changed
    if (!hasContentChanged() || isAutoSaving) {
      return;
    }
    
    // If offline, mark as pending changes
    if (!isOnline) {
      pendingChanges = true;
      return;
    }
    
    saveTimeout = setTimeout(() => {
      if (noteTitle && noteContent && hasContentChanged() && isOnline) {
        saveNote(true); // Pass true to indicate this is an auto-save
      }
    }, 1500); // Increased to 1.5 seconds for better performance
  }
  
  // Immediate save on certain triggers
  function triggerImmediateSave() {
    clearTimeout(saveTimeout);
    if (noteTitle && noteContent && hasContentChanged()) {
      saveNote(true);
    }
  }

  // Enhanced save note function with better error handling
  function saveNote(isAutoSave = false) {
    if (isAutoSaving) {
      return Promise.reject(new Error('Save already in progress'));
    }
    
    isAutoSaving = true;
    const noteId = new URLSearchParams(window.location.search).get('note');
    const method = noteId ? 'PUT' : 'POST';
    const url = noteId ? `/api/notes/${noteId}` : '/api/notes';
    
    const title = noteTitle.value || 'Untitled';
    const content = noteContent.value || '';
    
    // Show saving indicator for manual saves
    if (!isAutoSave) {
      showSaveIndicator('saving');
    }
    
    return fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content })
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to save note: ${res.status}`);
        }
        return res.json();
      })
      .then(note => {
        // Update URL if it's a new note
        if (!noteId) {
          window.history.replaceState({}, '', `/?note=${note.id}`);
        }
        
        // Update saved state
        updateLastSavedState();
        
        // Show success indicator
        if (isAutoSave) {
          showSaveIndicator('auto-saved');
        } else {
          showSaveIndicator('saved');
        }
        
        // Update note list if title changed
        updateNoteInList(note);
        
        return note;
      })
      .catch(err => {
        console.error('Error saving note:', err);
        showSaveIndicator('error');
        throw err;
      })
      .finally(() => {
        isAutoSaving = false;
      });
  }
  
  // Update note in sidebar list with better handling
  function updateNoteInList(note) {
    const noteListItem = document.querySelector(`li[data-id="${note.id}"]`);
    if (noteListItem) {
      const newTitle = note.title || 'Untitled';
      if (noteListItem.textContent !== newTitle) {
        noteListItem.textContent = newTitle;
        // Add a subtle animation
        noteListItem.style.transform = 'scale(1.02)';
        setTimeout(() => {
          noteListItem.style.transform = '';
        }, 200);
      }
    }
  }

  // Enhanced save status indicator with better positioning and styling
  function showSaveIndicator(status) {
    // Remove existing indicators
    const existingIndicator = document.querySelector('.save-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }
    
    // Create new indicator
    const indicator = document.createElement('div');
    indicator.className = 'save-indicator';
    
    let displayTime = 3000; // Default display time
    let icon = '';
    let bgColor = '';
    let textColor = 'white';
    
    switch (status) {
      case 'saving':
        icon = '💾';
        bgColor = '#FF9800';
        displayTime = 1000; // Show briefly
        break;
      case 'saved':
        icon = '✓';
        bgColor = '#4CAF50';
        break;
      case 'auto-saved':
        icon = '✓';
        bgColor = '#2196F3';
        displayTime = 2000; // Shorter for auto-save
        break;
      case 'deleted':
        icon = '🗑️';
        bgColor = '#FF5722';
        displayTime = 2000;
        break;
      case 'error':
        icon = '✗';
        bgColor = '#f44336';
        displayTime = 5000; // Show longer for errors
        break;
      case 'offline':
        icon = '📡';
        bgColor = '#FF5722';
        displayTime = 5000;
        break;
    }
    
    indicator.innerHTML = `${icon} ${status.charAt(0).toUpperCase() + status.slice(1)}`;
    indicator.style.background = bgColor;
    indicator.style.color = textColor;
    
    document.body.appendChild(indicator);
    
    // Animate in
    indicator.style.opacity = '0';
    indicator.style.transform = 'translateY(-20px)';
    setTimeout(() => {
      indicator.style.opacity = '1';
      indicator.style.transform = 'translateY(0)';
    }, 10);
    
    // Remove after specified time
    setTimeout(() => {
      indicator.style.opacity = '0';
      indicator.style.transform = 'translateY(-20px)';
      setTimeout(() => {
        if (indicator.parentNode) {
          indicator.remove();
        }
      }, 300);
    }, displayTime);
  }

  // Save note on form submit with better handling
  if (noteForm) {
    noteForm.addEventListener('submit', function (e) {
      e.preventDefault();
      saveNote().catch(err => {
        console.error('Save failed:', err);
      });
    });
  }

  // Enhanced auto-save event listeners
  if (noteTitle) {
    noteTitle.addEventListener('input', autoSave);
    noteTitle.addEventListener('blur', triggerImmediateSave); // Save when leaving title field
    
    // Initialize saved state when page loads
    setTimeout(() => updateLastSavedState(), 100);
  }
  
  if (noteContent) {
    noteContent.addEventListener('input', autoSave);
    noteContent.addEventListener('blur', triggerImmediateSave); // Save when leaving content area
    
    // Save on paste
    noteContent.addEventListener('paste', () => {
      setTimeout(triggerImmediateSave, 100); // Small delay to ensure paste content is processed
    });
    
    // Save on cut
    noteContent.addEventListener('cut', triggerImmediateSave);
  }
  
  // Save when window loses focus (user switches tabs/apps)
  window.addEventListener('blur', triggerImmediateSave);
  
  // Save before page unload with better handling
  window.addEventListener('beforeunload', (e) => {
    if (hasContentChanged()) {
      // Try to save synchronously (this might not work in all browsers)
      try {
        const noteId = new URLSearchParams(window.location.search).get('note');
        const method = noteId ? 'PUT' : 'POST';
        const url = noteId ? `/api/notes/${noteId}` : '/api/notes';
        
        const title = noteTitle.value || 'Untitled';
        const content = noteContent.value || '';
        
        // Use sendBeacon for better reliability
        const data = JSON.stringify({ title, content });
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url, data);
        }
      } catch (err) {
        console.log('Could not save before unload:', err);
      }
      
      // Show warning for unsaved changes
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
  });

  // Delete note with better confirmation
  if (deleteBtn) {
    deleteBtn.addEventListener('click', function () {
      const noteId = new URLSearchParams(window.location.search).get('note');
      if (!noteId) {
        alert('No note selected to delete.');
        return;
      }
      
      if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
        return;
      }
      
      // Show loading state
      deleteBtn.disabled = true;
      deleteBtn.textContent = '⏳';
      
      fetch(`/api/notes/${noteId}`, { method: 'DELETE' })
        .then(res => {
          if (!res.ok) {
            throw new Error('Failed to delete note');
          }
          return res.json();
        })
        .then(() => {
          showSaveIndicator('deleted');
          setTimeout(() => {
            window.location = '/';
          }, 1000);
        })
        .catch(err => {
          console.error('Error deleting note:', err);
          showSaveIndicator('error');
          // Reset button state
          deleteBtn.disabled = false;
          deleteBtn.textContent = '🗑️';
          alert('Failed to delete note. Please try again.');
        });
    });
  }

  // Modal logic for login/signup
  const openLoginBtn = document.getElementById('open-login');
  const loginModal = document.getElementById('login-modal');
  const signupModal = document.getElementById('signup-modal');
  const modalOverlay = document.getElementById('auth-modal-overlay');
  const showSignup = document.getElementById('show-signup');
  const showLogin = document.getElementById('show-login');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');

  function openModal(modal) {
    if (modalOverlay && modal) {
      modalOverlay.style.display = 'flex';
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }
  
  function closeModals() {
    if (modalOverlay) {
      modalOverlay.style.display = 'none';
    }
    if (loginModal) loginModal.style.display = 'none';
    if (signupModal) signupModal.style.display = 'none';
    document.body.style.overflow = '';
  }
  
  if (openLoginBtn) {
    openLoginBtn.addEventListener('click', function () {
      openModal(loginModal);
    });
  }
  if (showSignup) {
    showSignup.addEventListener('click', function (e) {
      e.preventDefault();
      if (loginModal) loginModal.style.display = 'none';
      if (signupModal) signupModal.style.display = 'flex';
    });
  }
  if (showLogin) {
    showLogin.addEventListener('click', function (e) {
      e.preventDefault();
      if (signupModal) signupModal.style.display = 'none';
      if (loginModal) loginModal.style.display = 'flex';
    });
  }
  if (modalOverlay) {
    modalOverlay.addEventListener('click', closeModals);
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModals();
  });

  // Show migration notification with better styling
  function showMigrationNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #4CAF50;
      color: white;
      padding: 24px 32px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      z-index: 10000;
      text-align: center;
      font-family: Georgia, serif;
      max-width: 90vw;
      backdrop-filter: blur(10px);
    `;
    notification.innerHTML = `
      <h3 style="margin: 0 0 12px 0; font-size: 1.4rem;">🎉 Welcome!</h3>
      <p style="margin: 0; font-size: 1.1rem;">Your notes have been saved to your account.</p>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.5s ease';
      setTimeout(() => notification.remove(), 500);
    }, 3000);
  }

  // Check if user just logged in and show migration notification
  if (window.location.search.includes('migrated=true')) {
    showMigrationNotification();
    // Clean up URL
    window.history.replaceState({}, '', window.location.pathname);
  }

  // Enhanced login/signup handling with better error messages
  function handleAuthSubmit(form, endpoint) {
    const formData = new FormData(form);
    const email = formData.get('email');
    const password = formData.get('password');
    
    if (!email || !password) {
      alert('Please fill in all fields');
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Please enter a valid email address');
      return;
    }
    
    // Validate password length
    if (password.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }
    
    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Processing...';
    
    // Check if user has guest notes before authenticating
    fetch('/api/user-status')
      .then(res => res.json())
      .then(status => {
        const hasGuestNotes = status.guestNotes > 0;
        
        // Submit the form
        return fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ email, password })
        }).then(res => {
          if (res.redirected) {
            // Successful login/signup
            if (hasGuestNotes) {
              // Add migration flag to URL
              window.location = res.url + '?migrated=true';
            } else {
              window.location = res.url;
            }
          } else {
            // Handle errors
            return res.text().then(html => {
              // Parse error from response if needed
              if (html.includes('Invalid credentials')) {
                throw new Error('Invalid email or password');
              } else if (html.includes('Email already exists')) {
                throw new Error('An account with this email already exists');
              } else {
                throw new Error('Authentication failed. Please try again.');
              }
            });
          }
        });
      })
      .catch(err => {
        console.error('Auth error:', err);
        alert(err.message || 'Something went wrong. Please try again.');
        // Reset button state
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      });
  }

  // AJAX login/signup - Fixed form selectors
  const loginFormElement = document.querySelector('#login-form form');
  const signupFormElement = document.querySelector('#signup-form form');
  
  if (loginFormElement) {
    loginFormElement.addEventListener('submit', function (e) {
      e.preventDefault();
      handleAuthSubmit(this, '/login');
    });
  }
  if (signupFormElement) {
    signupFormElement.addEventListener('submit', function (e) {
      e.preventDefault();
      handleAuthSubmit(this, '/register');
    });
  }

  // Auth form toggle functionality with better UX
  const authToggleBtns = document.querySelectorAll('.auth-toggle-btn');
  const signupFormBox = document.getElementById('signup-form');
  const loginFormBox = document.getElementById('login-form');

  if (authToggleBtns.length > 0) {
    authToggleBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        const formType = this.getAttribute('data-form');
        
        // Remove active class from all buttons
        authToggleBtns.forEach(b => b.classList.remove('active'));
        
        // Add active class to clicked button
        this.classList.add('active');
        
        // Show/hide forms with smooth transition
        if (formType === 'signup') {
          if (signupFormBox) {
            signupFormBox.style.display = 'block';
            signupFormBox.style.opacity = '0';
            setTimeout(() => {
              signupFormBox.style.opacity = '1';
            }, 10);
          }
          if (loginFormBox) loginFormBox.style.display = 'none';
        } else if (formType === 'login') {
          if (signupFormBox) signupFormBox.style.display = 'none';
          if (loginFormBox) {
            loginFormBox.style.display = 'block';
            loginFormBox.style.opacity = '0';
            setTimeout(() => {
              loginFormBox.style.opacity = '1';
            }, 10);
          }
        }
      });
    });
  }

  // Handle error state - show the form that has an error
  const signupError = signupFormBox && signupFormBox.querySelector('.auth-error');
  const loginError = loginFormBox && loginFormBox.querySelector('.auth-error');
  
  if (loginError && loginError.textContent.trim()) {
    // Show login form if there's a login error
    authToggleBtns.forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-form') === 'login') {
        btn.classList.add('active');
      }
    });
    if (signupFormBox) signupFormBox.style.display = 'none';
    if (loginFormBox) loginFormBox.style.display = 'block';
  } else if (signupError && signupError.textContent.trim()) {
    // Show signup form if there's a signup error
    authToggleBtns.forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-form') === 'signup') {
        btn.classList.add('active');
      }
    });
    if (signupFormBox) signupFormBox.style.display = 'block';
    if (loginFormBox) loginFormBox.style.display = 'none';
  }
  
  // Add smooth transitions to auth forms
  if (signupFormBox) signupFormBox.style.transition = 'opacity 0.3s ease';
  if (loginFormBox) loginFormBox.style.transition = 'opacity 0.3s ease';
}); 