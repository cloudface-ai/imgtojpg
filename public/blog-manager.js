// Blog Manager JavaScript
class BlogManager {
    constructor() {
        this.currentPost = null;
        this.quill = null;
        this.posts = this.loadPosts();
        this.categories = this.loadCategories();
        this.media = this.loadMedia();
        this.settings = this.loadSettings();
        
        this.init();
    }

    init() {
        console.log('Blog Manager initializing...');
        
        // Add global error handler
        window.addEventListener('error', (e) => {
            console.error('Global error caught:', e.error);
            this.showNotification(`JavaScript error: ${e.error?.message || 'Unknown error'}`, 'error');
        });
        
        // Add unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled promise rejection:', e.reason);
            this.showNotification(`Promise error: ${e.reason?.message || 'Unknown error'}`, 'error');
        });
        
        // Add DOM content loaded handler for safety
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeComponents());
        } else {
            this.initializeComponents();
        }
    }

    initializeComponents() {
        try {
            // Check authentication
            if (!this.checkAuth()) {
                console.log('Authentication failed - redirecting to login');
                window.location.href = '/blog-login.html';
                return;
            }

            console.log('Authentication successful, initializing components...');
            
            // Load data first
            this.loadData();
            
            this.initQuill();
            this.bindEvents();
            this.showSection('dashboard');
            this.updateDashboard();
            this.loadPostsList();
            this.loadCategoriesList();
            this.loadMediaGrid();
            console.log('Blog Manager initialized successfully');
        } catch (error) {
            console.error('Error during initialization:', error);
            this.showNotification('Error during initialization. Please refresh the page.', 'error');
        }
    }

    loadData() {
        try {
            console.log('Loading data from localStorage...');
            
            // Load posts
            this.posts = this.loadPosts();
            console.log(`Loaded ${this.posts.length} posts`);
            
            // Load categories
            this.categories = this.loadCategories();
            console.log(`Loaded ${this.categories.length} categories`);
            
            // Load media
            this.media = this.loadMedia();
            console.log(`Loaded ${this.media.length} media items`);
            
            // Load settings
            this.settings = this.loadSettings();
            console.log('Settings loaded');
            
            // Initialize currentPost if none exists
            if (!this.currentPost) {
                console.log('No current post, creating new one');
                this.newPost();
            }
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showNotification('Error loading data. Please refresh the page.', 'error');
        }
    }

    checkAuth() {
        const isAuth = localStorage.getItem('blogAuth') === 'true';
        const user = localStorage.getItem('blogUser');
        
        if (!isAuth || !user) {
            console.log('Authentication failed - redirecting to login');
            return false;
        }
        
        console.log('User authenticated:', user);
        return true;
    }

    logout() {
        localStorage.removeItem('blogAuth');
        localStorage.removeItem('blogUser');
        window.location.href = '/blog-login.html';
    }

    initQuill() {
        // Wait for Quill to be available
        const initQuillEditor = () => {
            console.log('Attempting to initialize Quill editor...');
            console.log('Quill available:', typeof Quill !== 'undefined');
            
            if (typeof Quill !== 'undefined') {
                try {
                    const editorElement = document.getElementById('editor');
                    if (!editorElement) {
                        console.error('Editor element not found');
                        this.fallbackToTextarea();
                        return;
                    }
                    
                    this.quill = new Quill('#editor', {
                        theme: 'snow',
                        modules: {
                            toolbar: [
                                [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                                ['bold', 'italic', 'underline', 'strike'],
                                [{ 'color': [] }, { 'background': [] }],
                                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                                [{ 'indent': '-1'}, { 'indent': '+1' }],
                                [{ 'align': [] }],
                                ['link', 'image', 'video'],
                                ['clean']
                            ]
                        },
                        placeholder: 'Start writing your blog post...'
                    });
                    console.log('Quill editor initialized successfully');
                    
                    // Hide loading indicator
                    const loadingIndicator = document.getElementById('editorLoading');
                    if (loadingIndicator) {
                        loadingIndicator.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Error initializing Quill:', error);
                    this.fallbackToTextarea();
                }
            } else {
                console.log('Quill not available, waiting...');
                // Retry after a short delay, but with timeout
                setTimeout(() => {
                    if (typeof Quill === 'undefined') {
                        console.log('Quill.js failed to load after timeout, using fallback editor');
                        this.fallbackToTextarea();
                    } else {
                        console.log('Quill became available, retrying initialization');
                        initQuillEditor();
                    }
                }, 2000); // Wait 2 seconds max
            }
        };
        
        initQuillEditor();
    }

    fallbackToTextarea() {
        console.log('Initializing fallback textarea editor');
        const editorContainer = document.getElementById('editor');
        if (editorContainer) {
            // Hide loading indicator
            const loadingIndicator = document.getElementById('editorLoading');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
            
            editorContainer.innerHTML = `
                <div class="mb-4">
                    <div class="flex space-x-2 mb-2 p-2 bg-gray-100 rounded-lg">
                        <button type="button" class="format-btn px-3 py-1 bg-white border rounded hover:bg-gray-50" data-format="bold"><strong>B</strong></button>
                        <button type="button" class="format-btn px-3 py-1 bg-white border rounded hover:bg-gray-50" data-format="italic"><em>I</em></button>
                        <button type="button" class="format-btn px-3 py-1 bg-white border rounded hover:bg-gray-50" data-format="underline"><u>U</u></button>
                        <button type="button" class="format-btn px-3 py-1 bg-white border rounded hover:bg-gray-50" data-format="h1">H1</button>
                        <button type="button" class="format-btn px-3 py-1 bg-white border rounded hover:bg-gray-50" data-format="h2">H2</button>
                        <button type="button" class="format-btn px-3 py-1 bg-white border rounded hover:bg-gray-50" data-format="h3">H3</button>
                        <button type="button" class="format-btn px-3 py-1 bg-white border rounded hover:bg-gray-50" data-format="ul">• List</button>
                        <button type="button" class="format-btn px-3 py-1 bg-white border rounded hover:bg-gray-50" data-format="ol">1. List</button>
                    </div>
                    <textarea id="fallbackEditor" class="w-full h-96 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Start writing your blog post..."></textarea>
                </div>
            `;
            
            // Bind format buttons
            document.querySelectorAll('.format-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const format = e.target.dataset.format;
                    const textarea = document.getElementById('fallbackEditor');
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;
                    
                    let replacement = '';
                    switch(format) {
                        case 'bold':
                            replacement = `**${text.substring(start, end)}**`;
                            break;
                        case 'italic':
                            replacement = `*${text.substring(start, end)}*`;
                            break;
                        case 'underline':
                            replacement = `<u>${text.substring(start, end)}</u>`;
                            break;
                        case 'h1':
                            replacement = `# ${text.substring(start, end)}`;
                            break;
                        case 'h2':
                            replacement = `## ${text.substring(start, end)}`;
                            break;
                        case 'h3':
                            replacement = `### ${text.substring(start, end)}`;
                            break;
                        case 'ul':
                            replacement = `• ${text.substring(start, end)}`;
                            break;
                        case 'ol':
                            replacement = `1. ${text.substring(start, end)}`;
                            break;
                    }
                    
                    textarea.value = text.substring(0, start) + replacement + text.substring(end);
                    textarea.focus();
                });
            });
            
            this.showNotification('Using fallback editor (Quill.js failed to load)', 'info');
        }
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.showSection(section);
                this.updateActiveNav(item);
            });
        });

        // Sidebar toggle
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('-translate-x-full');
        });

        // New post button
        document.getElementById('newPostBtn').addEventListener('click', () => {
            this.showSection('create');
            this.newPost();
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Post actions
        document.getElementById('saveDraftBtn').addEventListener('click', () => this.saveDraft());
        document.getElementById('previewBtn').addEventListener('click', () => this.previewPost());
        document.getElementById('publishBtn').addEventListener('click', () => this.publishPost());

        // Category management
        document.getElementById('addCategoryBtn').addEventListener('click', () => this.showCategoryModal());
        document.getElementById('saveCategoryBtn').addEventListener('click', () => this.saveCategory());
        document.getElementById('cancelCategoryBtn').addEventListener('click', () => this.hideCategoryModal());

        // Media management
        document.getElementById('uploadMediaBtn').addEventListener('click', () => this.showMediaModal());
        document.getElementById('refreshMediaBtn').addEventListener('click', () => this.refreshMediaLibrary());
        document.getElementById('clearStorageBtn').addEventListener('click', () => this.clearStorage());
        document.getElementById('selectMediaBtn').addEventListener('click', () => document.getElementById('mediaUpload').click());
        document.getElementById('cancelMediaBtn').addEventListener('click', () => this.hideMediaModal());

        // File uploads
        document.getElementById('mediaUpload').addEventListener('change', (e) => this.handleMediaUpload(e));
        document.getElementById('featuredImage').addEventListener('change', (e) => this.handleFeaturedImage(e));
        
        // Featured image container and remove button
        const featuredImageContainer = document.getElementById('featuredImageContainer');
        const featuredImage = document.getElementById('featuredImage');
        const removeFeaturedImageBtn = document.getElementById('removeFeaturedImage');
        
        if (featuredImageContainer && featuredImage) {
            featuredImageContainer.addEventListener('click', () => {
                // Ensure we have a current post before allowing featured image upload
                if (this.ensureCurrentPost()) {
                    featuredImage.click();
                }
            });
        }
        
        if (removeFeaturedImageBtn) {
            removeFeaturedImageBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeFeaturedImage();
            });
        }

        // Auto-SEO generation
        document.getElementById('autoTitleBtn').addEventListener('click', () => this.autoGenerateTitle());
        document.getElementById('autoDescBtn').addEventListener('click', () => this.autoGenerateDescription());
        document.getElementById('autoKeywordsBtn').addEventListener('click', () => this.autoGenerateKeywords());
        document.getElementById('autoTagsBtn').addEventListener('click', () => this.autoGenerateTags());

        // Initialize drag and drop
        this.initDragAndDrop();

        // Search and filters
        document.getElementById('searchPosts').addEventListener('input', (e) => this.filterPosts(e.target.value));
        document.getElementById('statusFilter').addEventListener('change', (e) => this.filterPostsByStatus(e.target.value));

        // Settings save
        document.querySelectorAll('#settings input, #settings textarea').forEach(input => {
            input.addEventListener('change', () => this.saveSettings());
        });

        // Quick Actions
        document.getElementById('quickCreatePost').addEventListener('click', () => {
            this.showSection('create');
            this.newPost();
        });

        document.getElementById('quickUploadMedia').addEventListener('click', () => {
            this.showSection('media');
            this.showMediaModal();
        });

        document.getElementById('quickManageSettings').addEventListener('click', () => {
            this.showSection('settings');
        });

        document.getElementById('quickViewBlog').addEventListener('click', () => {
            window.open('/blog.html', '_blank');
        });
    }

    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.add('hidden');
        });

        // Show selected section
        document.getElementById(sectionName).classList.remove('hidden');

        // Update active navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('text-blue-600', 'bg-blue-50');
            if (item.dataset.section === sectionName) {
                item.classList.add('text-blue-600', 'bg-blue-50');
            }
        });
    }

    updateActiveNav(activeItem) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('text-blue-600', 'bg-blue-50');
        });
        activeItem.classList.add('text-blue-600', 'bg-blue-50');
    }

    newPost() {
        try {
            this.currentPost = {
                id: Date.now(),
                title: '',
                content: '',
                status: 'draft',
                publishDate: new Date().toISOString().slice(0, 16),
                categories: '',
                tags: '',
                featuredImage: '',
                metaTitle: '',
                metaDescription: '',
                metaKeywords: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                views: 0
            };

            console.log('New post created with ID:', this.currentPost.id);

            this.loadPostIntoForm();
            this.clearForm(); // Clear the form completely
            
            const createTitle = document.getElementById('createTitle');
            if (createTitle) {
                createTitle.textContent = 'Create New Post';
            }
            
        } catch (error) {
            console.error('Error creating new post:', error);
            this.showNotification('Error creating new post. Please try again.', 'error');
        }
    }

    clearForm() {
        // Clear all form fields
        document.getElementById('postTitle').value = '';
        document.getElementById('postStatus').value = 'draft';
        document.getElementById('publishDate').value = new Date().toISOString().slice(0, 16);
        document.getElementById('postCategories').value = '';
        document.getElementById('postTags').value = '';
        document.getElementById('metaTitle').value = '';
        document.getElementById('metaDescription').value = '';
        document.getElementById('metaKeywords').value = '';
        
        // Clear editor content
        if (this.quill) {
            this.quill.root.innerHTML = '';
        } else {
            const fallbackEditor = document.getElementById('fallbackEditor');
            if (fallbackEditor) {
                fallbackEditor.value = '';
            }
        }
        
        // Clear featured image
        this.removeFeaturedImage();
        
        console.log('Form cleared successfully');
    }

    editPost(postId) {
        try {
            this.currentPost = this.posts.find(post => post.id === postId);
            if (this.currentPost) {
                console.log('Editing post:', this.currentPost.title);
                this.loadPostIntoForm();
                
                const createTitle = document.getElementById('createTitle');
                if (createTitle) {
                    createTitle.textContent = 'Edit Post';
                }
                
                this.showSection('create');
            } else {
                console.error('Post not found for editing:', postId);
                this.showNotification('Post not found for editing', 'error');
            }
        } catch (error) {
            console.error('Error editing post:', error);
            this.showNotification('Error editing post. Please try again.', 'error');
        }
    }

    duplicatePost(postId) {
        const originalPost = this.posts.find(post => post.id === postId);
        if (originalPost) {
            this.currentPost = {
                ...originalPost,
                id: Date.now(),
                title: originalPost.title + ' (Copy)',
                status: 'draft',
                publishDate: new Date().toISOString().slice(0, 16),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                views: 0
            };
            this.loadPostIntoForm();
            document.getElementById('createTitle').textContent = 'Duplicate Post';
            this.showSection('create');
        }
    }

    deletePost(postId) {
        if (confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
            const index = this.posts.findIndex(post => post.id === postId);
            if (index !== -1) {
                this.posts.splice(index, 1);
                this.savePosts();
                this.updateDashboard();
                this.loadPostsList();
                this.showNotification('Post deleted successfully', 'success');
            }
        }
    }

    previewPostById(postId) {
        const post = this.posts.find(post => post.id === postId);
        if (post) {
            this.currentPost = post;
            this.previewPost();
        }
    }

    loadPostIntoForm() {
        if (!this.currentPost) return;

        document.getElementById('postTitle').value = this.currentPost.title;
        document.getElementById('postStatus').value = this.currentPost.status;
        document.getElementById('publishDate').value = this.currentPost.publishDate;
        document.getElementById('postCategories').value = this.currentPost.categories;
        document.getElementById('postTags').value = this.currentPost.tags;
        document.getElementById('metaTitle').value = this.currentPost.metaTitle;
        document.getElementById('metaDescription').value = this.currentPost.metaDescription;
        document.getElementById('metaKeywords').value = this.currentPost.metaKeywords;

        // Handle featured image
        if (this.currentPost.featuredImage) {
            this.displayFeaturedImage(this.currentPost.featuredImage);
        } else {
            this.removeFeaturedImage();
        }

        // Set content in appropriate editor
        if (this.quill) {
            this.quill.root.innerHTML = this.currentPost.content || '';
        } else {
            const fallbackEditor = document.getElementById('fallbackEditor');
            if (fallbackEditor) {
                fallbackEditor.value = this.currentPost.content || '';
            }
        }
    }

    saveDraft() {
        try {
            console.log('Saving draft...');
            
            // Basic validation for drafts
            if (!this.validatePostForm()) {
                return;
            }
            
            this.savePost('draft');
        } catch (error) {
            console.error('Error saving draft:', error);
            this.showNotification('Error saving draft. Please try again.', 'error');
        }
    }

    publishPost() {
        try {
            console.log('Publishing post...');
            
            // Full validation for published posts
            if (!this.validatePostForm()) {
                return;
            }
            
            this.savePost('published');
        } catch (error) {
            console.error('Error publishing post:', error);
            this.showNotification('Error publishing post. Please try again.', 'error');
        }
    }

    savePost(status) {
        try {
            console.log(`Saving post with status: ${status}`);
            
            // Validate currentPost exists
            if (!this.currentPost) {
                console.error('No current post available for saving');
                this.showNotification('No post to save. Please create a new post first.', 'error');
                return;
            }

            // Get form elements with validation
            const titleElement = document.getElementById('postTitle');
            const publishDateElement = document.getElementById('publishDate');
            const categoriesElement = document.getElementById('postCategories');
            const tagsElement = document.getElementById('postTags');
            const metaTitleElement = document.getElementById('metaTitle');
            const metaDescriptionElement = document.getElementById('metaDescription');
            const metaKeywordsElement = document.getElementById('metaKeywords');

            if (!titleElement) {
                console.error('Post title element not found');
                this.showNotification('Form elements not found. Please refresh the page.', 'error');
                return;
            }

            // Validate required fields
            const title = titleElement.value.trim();
            if (!title) {
                this.showNotification('Please enter a post title', 'error');
                titleElement.focus();
                return;
            }

            // Update post data
            this.currentPost.title = title;
            
            // Get content from either Quill editor or fallback textarea
            if (this.quill && this.quill.root) {
                this.currentPost.content = this.quill.root.innerHTML;
                console.log('Content saved from Quill editor');
            } else {
                const fallbackEditor = document.getElementById('fallbackEditor');
                if (fallbackEditor) {
                    this.currentPost.content = fallbackEditor.value;
                    console.log('Content saved from fallback editor');
                } else {
                    this.currentPost.content = '';
                    console.warn('No editor found, content set to empty');
                }
            }
            
            this.currentPost.status = status;
            this.currentPost.publishDate = publishDateElement ? publishDateElement.value : new Date().toISOString().slice(0, 16);
            this.currentPost.categories = categoriesElement ? categoriesElement.value : '';
            this.currentPost.tags = tagsElement ? tagsElement.value : '';
            this.currentPost.metaTitle = metaTitleElement ? metaTitleElement.value : '';
            this.currentPost.metaDescription = metaDescriptionElement ? metaDescriptionElement.value : '';
            this.currentPost.metaKeywords = metaKeywordsElement ? metaKeywordsElement.value : '';
            this.currentPost.updatedAt = new Date().toISOString();

            // Set publish date for published posts
            if (status === 'published' && !this.currentPost.publishDate) {
                this.currentPost.publishDate = new Date().toISOString();
            }

            console.log('Post data updated:', {
                id: this.currentPost.id,
                title: this.currentPost.title,
                status: this.currentPost.status,
                contentLength: this.currentPost.content.length
            });

            // Ensure posts array exists
            if (!this.posts) {
                this.posts = [];
                console.log('Posts array initialized');
            }

            // Save to storage
            if (this.currentPost.id) {
                const index = this.posts.findIndex(post => post.id === this.currentPost.id);
                if (index !== -1) {
                    this.posts[index] = { ...this.currentPost };
                    console.log(`Post updated at index ${index}`);
                } else {
                    this.posts.push({ ...this.currentPost });
                    console.log('Post added to posts array');
                }
            } else {
                this.posts.push({ ...this.currentPost });
                console.log('New post added to posts array');
            }

            // Save to localStorage
            this.savePosts();
            console.log('Posts saved to localStorage');

            // Update UI
            this.updateDashboard();
            this.loadPostsList();

            // Show success message with post details
            const successMessage = status === 'published' 
                ? `Post "${title}" published successfully!` 
                : `Draft "${title}" saved successfully!`;
            
            this.showNotification(successMessage, 'success');

            console.log(`Post saved successfully with status: ${status}`);
            
            // Log post details for debugging
            console.log('Saved post details:', {
                id: this.currentPost.id,
                title: this.currentPost.title,
                status: this.currentPost.status,
                publishDate: this.currentPost.publishDate,
                contentLength: this.currentPost.content.length,
                categories: this.currentPost.categories,
                tags: this.currentPost.tags
            });

        } catch (error) {
            console.error('Error in savePost:', error);
            this.showNotification(`Error saving post: ${error.message}`, 'error');
        }
    }

    previewPost() {
        const title = document.getElementById('postTitle').value;
        
        // Get content from appropriate editor
        let content = '';
        if (this.quill) {
            content = this.quill.root.innerHTML;
        } else {
            const fallbackEditor = document.getElementById('fallbackEditor');
            if (fallbackEditor) {
                content = fallbackEditor.value;
            }
        }
        
        if (!title.trim()) {
            this.showNotification('Please enter a post title', 'error');
            return;
        }

        // Create preview window
        const previewWindow = window.open('', '_blank');
        previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Preview: ${title}</title>
                <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body class="bg-gray-50">
                <div class="max-w-4xl mx-auto p-8">
                    <div class="bg-white rounded-lg shadow-lg p-8">
                        <h1 class="text-4xl font-bold text-gray-900 mb-6">${title}</h1>
                        <div class="prose max-w-none">
                            ${content}
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
        previewWindow.document.close();
    }

    deletePost(postId) {
        if (confirm('Are you sure you want to delete this post?')) {
            this.posts = this.posts.filter(post => post.id !== postId);
            this.savePosts();
            this.updateDashboard();
            this.loadPostsList();
            this.showNotification('Post deleted successfully', 'success');
        }
    }

    duplicatePost(postId) {
        const originalPost = this.posts.find(post => post.id === postId);
        if (originalPost) {
            const duplicatedPost = {
                ...originalPost,
                id: Date.now(),
                title: `${originalPost.title} (Copy)`,
                status: 'draft',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                views: 0
            };
            this.posts.push(duplicatedPost);
            this.savePosts();
            this.updateDashboard();
            this.loadPostsList();
            this.showNotification('Post duplicated successfully', 'success');
        }
    }

    loadPostsList() {
        const postsList = document.getElementById('postsList');
        if (!postsList) return;

        postsList.innerHTML = this.posts.map(post => `
            <div class="post-card bg-white p-6 rounded-lg shadow-sm border" data-post-id="${post.id}">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="flex items-center space-x-3 mb-2">
                            <h3 class="text-lg font-semibold text-gray-900">${post.title || 'Untitled Post'}</h3>
                            <span class="status-${post.status} px-2 py-1 rounded-full text-xs font-medium">
                                ${post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                            </span>
                        </div>
                        <p class="text-gray-600 text-sm mb-3">
                            ${post.content ? post.content.replace(/<[^>]*>/g, '').substring(0, 150) + '...' : 'No content'}
                        </p>
                        <div class="flex items-center space-x-4 text-sm text-gray-500">
                            <span><i class="fas fa-calendar mr-1"></i>${new Date(post.createdAt).toLocaleDateString()}</span>
                            <span><i class="fas fa-eye mr-1"></i>${post.views} views</span>
                            <span><i class="fas fa-folder mr-1"></i>${post.categories || 'Uncategorized'}</span>
                        </div>
                    </div>
                    <div class="flex space-x-2">
                        <button class="edit-post-btn text-blue-600 hover:text-blue-800 p-2" data-post-id="${post.id}" title="Edit Post">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="preview-post-btn text-purple-600 hover:text-purple-800 p-2" data-post-id="${post.id}" title="Preview Post">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="duplicate-post-btn text-green-600 hover:text-green-800 p-2" data-post-id="${post.id}" title="Duplicate Post">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="delete-post-btn text-red-600 hover:text-red-800 p-2" data-post-id="${post.id}" title="Delete Post">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Add event listeners to the new buttons
        this.bindPostActionEvents();
    }

    filterPosts(searchTerm) {
        const filteredPosts = this.posts.filter(post => 
            post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
            post.categories.toLowerCase().includes(searchTerm.toLowerCase()) ||
            post.tags.toLowerCase().includes(searchTerm.toLowerCase())
        );
        this.displayFilteredPosts(filteredPosts);
    }

    filterPostsByStatus(status) {
        if (!status) {
            this.loadPostsList();
            return;
        }
        const filteredPosts = this.posts.filter(post => post.status === status);
        this.displayFilteredPosts(filteredPosts);
    }

    displayFilteredPosts(posts) {
        const postsList = document.getElementById('postsList');
        if (!postsList) return;

        postsList.innerHTML = posts.map(post => `
            <div class="post-card bg-white p-6 rounded-lg shadow-sm border" data-post-id="${post.id}">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="flex items-center space-x-3 mb-2">
                            <h3 class="text-lg font-semibold text-gray-900">${post.title || 'Untitled Post'}</h3>
                            <span class="status-${post.status} px-2 py-1 rounded-full text-xs font-medium">
                                ${post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                            </span>
                        </div>
                        <p class="text-gray-600 text-sm mb-3">
                            ${post.content ? post.content.replace(/<[^>]*>/g, '').substring(0, 150) + '...' : 'No content'}
                        </p>
                        <div class="flex items-center space-x-4 text-sm text-gray-500">
                            <span><i class="fas fa-calendar mr-1"></i>${new Date(post.createdAt).toLocaleDateString()}</span>
                            <span><i class="fas fa-eye mr-1"></i>${post.views} views</span>
                            <span><i class="fas fa-folder mr-1"></i>${post.categories || 'Uncategorized'}</span>
                        </div>
                    </div>
                    <div class="flex space-x-2">
                        <button class="edit-post-btn text-blue-600 hover:text-blue-800 p-2" data-post-id="${post.id}" title="Edit Post">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="preview-post-btn text-purple-600 hover:text-purple-800 p-2" data-post-id="${post.id}" title="Preview Post">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="duplicate-post-btn text-green-600 hover:text-green-800 p-2" data-post-id="${post.id}" title="Duplicate Post">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="delete-post-btn text-red-600 hover:text-red-800 p-2" data-post-id="${post.id}" title="Delete Post">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Add event listeners to the new buttons
        this.bindPostActionEvents();
    }

    bindPostActionEvents() {
        // Edit post buttons
        document.querySelectorAll('.edit-post-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const postId = parseInt(e.target.closest('button').dataset.postId);
                this.editPost(postId);
            });
        });

        // Preview post buttons
        document.querySelectorAll('.preview-post-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const postId = parseInt(e.target.closest('button').dataset.postId);
                this.previewPostById(postId);
            });
        });

        // Duplicate post buttons
        document.querySelectorAll('.duplicate-post-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const postId = parseInt(e.target.closest('button').dataset.postId);
                this.duplicatePost(postId);
            });
        });

        // Delete post buttons
        document.querySelectorAll('.delete-post-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const postId = parseInt(e.target.closest('button').dataset.postId);
                this.deletePost(postId);
            });
        });
    }

    updateDashboard() {
        const totalPosts = this.posts.length;
        const publishedPosts = this.posts.filter(post => post.status === 'published').length;
        const draftPosts = this.posts.filter(post => post.status === 'draft').length;
        const totalViews = this.posts.reduce((sum, post) => sum + post.views, 0);

        document.getElementById('totalPosts').textContent = totalPosts;
        document.getElementById('publishedPosts').textContent = publishedPosts;
        document.getElementById('draftPosts').textContent = draftPosts;
        document.getElementById('totalViews').textContent = totalViews;

        // Update recent posts
        const recentPosts = document.getElementById('recentPosts');
        if (recentPosts) {
            const recent = this.posts
                .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
                .slice(0, 5);

            recentPosts.innerHTML = recent.map(post => `
                <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                        <p class="font-medium text-gray-900">${post.title || 'Untitled Post'}</p>
                        <p class="text-sm text-gray-500">${new Date(post.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <span class="status-${post.status} px-2 py-1 rounded-full text-xs font-medium">
                        ${post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                    </span>
                </div>
            `).join('');
        }
    }

    showCategoryModal() {
        document.getElementById('categoryModal').classList.remove('hidden');
        document.getElementById('categoryName').value = '';
        document.getElementById('categoryDescription').value = '';
    }

    hideCategoryModal() {
        document.getElementById('categoryModal').classList.add('hidden');
    }

    saveCategory() {
        const name = document.getElementById('categoryName').value.trim();
        const description = document.getElementById('categoryDescription').value.trim();

        if (!name) {
            this.showNotification('Category name is required', 'error');
            return;
        }

        const newCategory = {
            id: Date.now(),
            name,
            description,
            postCount: 0,
            createdAt: new Date().toISOString()
        };

        this.categories.push(newCategory);
        this.saveCategories();
        this.loadCategoriesList();
        this.hideCategoryModal();
        this.showNotification('Category created successfully', 'success');
    }

    deleteCategory(categoryId) {
        if (confirm('Are you sure you want to delete this category?')) {
            this.categories = this.categories.filter(cat => cat.id !== categoryId);
            this.saveCategories();
            this.loadCategoriesList();
            this.showNotification('Category deleted successfully', 'success');
        }
    }

    loadCategoriesList() {
        const categoriesList = document.getElementById('categoriesList');
        if (!categoriesList) return;

        categoriesList.innerHTML = this.categories.map(category => `
            <div class="bg-white p-6 rounded-lg shadow-sm border">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-2">${category.name}</h3>
                        <p class="text-gray-600 text-sm mb-3">${category.description || 'No description'}</p>
                        <p class="text-sm text-gray-500">${category.postCount} posts</p>
                    </div>
                    <button onclick="blogManager.deleteCategory(${category.id})" class="text-red-600 hover:text-red-800 p-2">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    showMediaModal() {
        const mediaModal = document.getElementById('mediaModal');
        if (!mediaModal) {
            console.error('Media modal element not found');
            return;
        }
        
        // Ensure the form is in a clean state before showing
        this.resetUploadForm();
        
        // Show the modal
        mediaModal.classList.remove('hidden');
        
        console.log('Media modal opened with clean state');
    }

    hideMediaModal() {
        const mediaModal = document.getElementById('mediaModal');
        if (!mediaModal) {
            console.error('Media modal element not found');
            return;
        }
        
        mediaModal.classList.add('hidden');
        
        // Reset the form state when modal is closed
        setTimeout(() => {
            this.resetUploadForm();
        }, 300); // Small delay to ensure modal is hidden
    }

    initDragAndDrop() {
        const dragDropArea = document.getElementById('dragDropArea');
        const uploadIcon = document.getElementById('uploadIcon');
        const dragText = document.getElementById('dragText');
        
        if (!dragDropArea || !uploadIcon || !dragText) {
            console.warn('Drag and drop elements not found');
            return;
        }

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dragDropArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // Drag enter/over effects
        ['dragenter', 'dragover'].forEach(eventName => {
            dragDropArea.addEventListener(eventName, () => {
                dragDropArea.classList.add('border-blue-500', 'bg-blue-100');
                uploadIcon.classList.remove('text-gray-400');
                uploadIcon.classList.add('text-blue-500');
                dragText.textContent = 'Drop files here!';
            });
        });

        // Drag leave effects
        dragDropArea.addEventListener('dragleave', () => {
            dragDropArea.classList.remove('border-blue-500', 'bg-blue-100');
            uploadIcon.classList.remove('text-blue-500');
            uploadIcon.classList.add('text-gray-400');
            dragText.textContent = 'Drag and drop files here or';
        });

        // Drop handling
        dragDropArea.addEventListener('drop', (e) => {
            dragDropArea.classList.remove('border-blue-500', 'bg-blue-100');
            uploadIcon.classList.remove('text-blue-500');
            uploadIcon.classList.add('text-gray-400');
            dragText.textContent = 'Drag and drop files here or';

            const files = Array.from(e.dataTransfer.files);
            this.processMediaFiles(files);
        });
    }

    handleMediaUpload(event) {
        const files = Array.from(event.target.files);
        this.processMediaFiles(files);
    }

    processMediaFiles(files) {
        try {
            console.log('Processing files:', files.length);
            
            if (!files || files.length === 0) {
                this.showNotification('No files selected', 'error');
                return;
            }
            
            const imageFiles = files.filter(file => file.type.startsWith('image/'));
            
            if (imageFiles.length === 0) {
                this.showNotification('No valid image files selected. Please select JPG, PNG, GIF, WebP, or SVG files.', 'error');
                return;
            }

            if (imageFiles.length > 10) {
                this.showNotification('Maximum 10 files can be uploaded at once. Please select fewer files.', 'error');
                return;
            }

            // Check file sizes (max 2MB per file)
            const oversizedFiles = imageFiles.filter(file => file.size > 2 * 1024 * 1024);
            if (oversizedFiles.length > 0) {
                this.showNotification(`Some files are too large (max 2MB): ${oversizedFiles.map(f => f.name).join(', ')}`, 'error');
                return;
            }

            console.log(`Starting upload of ${imageFiles.length} valid image files`);
            
            // Check if upload progress elements exist before proceeding
            if (!this.checkUploadElements()) {
                this.showNotification('Upload system not ready. Please refresh the page.', 'error');
                return;
            }
            
            this.showUploadProgress(imageFiles.length);
            this.uploadMultipleFiles(imageFiles);
            
        } catch (error) {
            console.error('Error processing media files:', error);
            this.showNotification('Error processing files. Please try again.', 'error');
        }
    }

    checkUploadElements() {
        const requiredElements = [
            'uploadProgress',
            'uploadCount', 
            'progressBar',
            'uploadActions'
        ];
        
        for (const elementId of requiredElements) {
            if (!document.getElementById(elementId)) {
                console.error(`Required upload element not found: ${elementId}`);
                return false;
            }
        }
        
        return true;
    }

    ensureCurrentPost() {
        if (!this.currentPost) {
            console.log('No current post, creating new one');
            this.newPost();
            return false;
        }
        return true;
    }

    validatePostForm() {
        const title = document.getElementById('postTitle')?.value?.trim();
        const content = this.getEditorContent()?.trim();
        
        if (!title) {
            this.showNotification('Please enter a post title', 'error');
            return false;
        }
        
        if (!content || content.length < 10) {
            this.showNotification('Please add some content to your post (at least 10 characters)', 'error');
            return false;
        }
        
        return true;
    }

    showUploadProgress(totalFiles) {
        const uploadProgress = document.getElementById('uploadProgress');
        const uploadCount = document.getElementById('uploadCount');
        const progressBar = document.getElementById('progressBar');
        
        if (!uploadProgress || !uploadCount || !progressBar) {
            console.error('Upload progress elements not found');
            return;
        }
        
        uploadProgress.classList.remove('hidden');
        uploadCount.textContent = `0/${totalFiles}`;
        progressBar.style.width = '0%';
        
        // Update the progress text
        const progressText = uploadProgress.querySelector('span:first-child');
        if (progressText) {
            progressText.textContent = `Uploading ${totalFiles} file${totalFiles > 1 ? 's' : ''}...`;
        }
        
        console.log(`Upload progress started for ${totalFiles} files`);
    }

    hideUploadProgress() {
        const uploadProgress = document.getElementById('uploadProgress');
        const mediaUpload = document.getElementById('mediaUpload');
        
        if (uploadProgress) {
            uploadProgress.classList.add('hidden');
        }
        
        // Reset file input
        if (mediaUpload) {
            mediaUpload.value = '';
        }
    }

    showUploadComplete(totalFiles) {
        console.log(`Showing upload complete for ${totalFiles} files`);
        
        // Hide the upload actions
        const uploadActions = document.getElementById('uploadActions');
        if (uploadActions) {
            uploadActions.classList.add('hidden');
        }
        
        const uploadProgress = document.getElementById('uploadProgress');
        if (!uploadProgress) {
            console.error('Upload progress element not found');
            return;
        }
        
        uploadProgress.innerHTML = `
            <div class="space-y-4">
                <div class="text-center">
                    <i class="fas fa-check-circle text-5xl text-green-500 mb-4"></i>
                    <p class="text-green-600 font-semibold text-lg">${totalFiles} files uploaded successfully!</p>
                    <p class="text-sm text-gray-500 mt-2">Your media is now available in the library</p>
                </div>
                <div class="flex space-x-3">
                    <button id="uploadDoneBtn" class="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                        <i class="fas fa-check mr-2"></i>Done
                    </button>
                    <button id="uploadMoreBtn" class="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <i class="fas fa-plus mr-2"></i>Upload More
                    </button>
                    <button id="viewMediaBtn" class="flex-1 border border-blue-300 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors">
                        <i class="fas fa-images mr-2"></i>View Media
                    </button>
                </div>
            </div>
        `;
        uploadProgress.classList.remove('hidden');
        
        // Add event listeners to the new buttons
        this.bindUploadCompleteEvents();
        
        console.log('Upload complete UI displayed');
    }

    bindUploadCompleteEvents() {
        console.log('Binding upload complete events');
        
        // Done button - close modal
        const doneBtn = document.getElementById('uploadDoneBtn');
        if (doneBtn) {
            doneBtn.addEventListener('click', () => {
                console.log('Done button clicked, closing modal');
                this.hideMediaModal();
            });
        } else {
            console.warn('Done button not found');
        }

        // Upload More button - reset form
        const moreBtn = document.getElementById('uploadMoreBtn');
        if (moreBtn) {
            moreBtn.addEventListener('click', () => {
                console.log('Upload More button clicked, resetting form');
                this.resetUploadForm();
            });
        } else {
            console.warn('Upload More button not found');
        }

        // View Media button - go to media library
        const viewBtn = document.getElementById('viewMediaBtn');
        if (viewBtn) {
            viewBtn.addEventListener('click', () => {
                console.log('View Media button clicked, going to media library');
                this.hideMediaModal();
                this.showSection('media');
            });
        } else {
            console.warn('View Media button not found');
        }
    }

    resetUploadForm() {
        // Get all required elements
        const uploadProgress = document.getElementById('uploadProgress');
        const dragDropArea = document.getElementById('dragDropArea');
        const uploadIcon = document.getElementById('uploadIcon');
        const dragText = document.getElementById('dragText');
        const mediaUpload = document.getElementById('mediaUpload');
        const uploadActions = document.getElementById('uploadActions');
        
        // Check if elements exist before using them
        if (!uploadProgress || !dragDropArea || !uploadIcon || !dragText || !mediaUpload || !uploadActions) {
            console.error('Some upload form elements not found');
            return;
        }
        
        // Reset the upload form completely
        uploadProgress.classList.add('hidden');
        dragDropArea.classList.remove('border-blue-500', 'bg-blue-100');
        uploadIcon.classList.remove('text-blue-500');
        uploadIcon.classList.add('text-gray-400');
        dragText.textContent = 'Drag and drop files here or';
        
        // Reset file input
        mediaUpload.value = '';
        
        // Show upload actions again
        uploadActions.classList.remove('hidden');
        
        // Reset upload progress structure
        uploadProgress.innerHTML = `
            <div class="space-y-3">
                <div class="flex items-center justify-between text-sm">
                    <span>Uploading...</span>
                    <span id="uploadCount">0/0</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div id="progressBar" class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                </div>
            </div>
        `;
        
        console.log('Upload form reset successfully');
    }

    uploadMultipleFiles(files) {
        let completed = 0;
        const total = files.length;
        const startTime = Date.now();

        console.log(`Starting upload of ${total} files`);

        // Add timeout for each file (30 seconds)
        const uploadTimeout = 30000;

        files.forEach((file, index) => {
            const fileStartTime = Date.now();
            
            // Create a timeout for this file
            const timeoutId = setTimeout(() => {
                console.error(`Upload timeout for file: ${file.name}`);
                this.showNotification(`Upload timeout for ${file.name}`, 'error');
                completed++;
                this.updateUploadProgress(completed, total);
                
                if (completed === total) {
                    this.handleUploadCompletion(total, startTime);
                }
            }, uploadTimeout);

            this.uploadMediaFile(file, () => {
                clearTimeout(timeoutId); // Clear timeout on success
                
                const fileTime = Date.now() - fileStartTime;
                completed++;
                console.log(`File ${completed}/${total} completed: ${file.name} (${fileTime}ms)`);
                this.updateUploadProgress(completed, total);
                
                if (completed === total) {
                    this.handleUploadCompletion(total, startTime);
                }
            });
        });
    }

    handleUploadCompletion(total, startTime) {
        const totalTime = Date.now() - startTime;
        console.log(`All ${total} files uploaded in ${totalTime}ms, showing completion`);
        
        // Verify media was actually saved
        console.log('Current media count:', this.media.length);
        console.log('Media items:', this.media);
        
        setTimeout(() => {
            this.showNotification(`${total} files uploaded successfully in ${Math.round(totalTime/1000)}s!`, 'success');
            this.showUploadComplete(total);
        }, 500);
    }

    cleanupOldMedia() {
        console.log('Cleaning up old media to free storage space...');
        
        if (this.media.length <= 5) {
            console.log('Not enough media to clean up');
            return;
        }
        
        // Sort by creation date (oldest first)
        const sortedMedia = [...this.media].sort((a, b) => 
            new Date(a.createdAt) - new Date(b.createdAt)
        );
        
        // Remove oldest 20% of media files
        const removeCount = Math.max(1, Math.floor(this.media.length * 0.2));
        const toRemove = sortedMedia.slice(0, removeCount);
        
        console.log(`Removing ${removeCount} old media files to free space`);
        
        toRemove.forEach(item => {
            const index = this.media.findIndex(m => m.id === item.id);
            if (index !== -1) {
                this.media.splice(index, 1);
                console.log(`Removed old media: ${item.name}`);
            }
        });
        
        // Try to save the cleaned media list
        try {
            this.saveMedia();
            console.log('Cleaned media list saved successfully');
        } catch (error) {
            console.error('Error saving cleaned media list:', error);
        }
    }

    uploadMediaFile(file, callback) {
        console.log(`Starting upload for file: ${file.name} (${file.size} bytes, ${file.type})`);
        
        // Check file size before processing (max 2MB to avoid localStorage issues)
        if (file.size > 2 * 1024 * 1024) {
            this.showNotification(`File ${file.name} is too large (${Math.round(file.size/1024/1024*100)/100}MB). Max size is 2MB.`, 'error');
            if (callback) callback();
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                console.log(`File loaded successfully: ${file.name}`);
                
                // Create a more compact media item
                const mediaItem = {
                    id: Date.now() + Math.random(),
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    url: e.target.result,
                    createdAt: new Date().toISOString()
                };
                
                console.log('Created media item:', mediaItem);
                
                this.media.push(mediaItem);
                console.log('Added to media array, current length:', this.media.length);
                
                // Try to save media, but handle quota errors gracefully
                try {
                    this.saveMedia();
                    console.log('Media saved to localStorage');
                } catch (storageError) {
                    if (storageError.name === 'QuotaExceededError') {
                        console.warn('localStorage quota exceeded, trying to clean up old media');
                        this.cleanupOldMedia();
                        try {
                            this.saveMedia();
                            console.log('Media saved after cleanup');
                        } catch (cleanupError) {
                            console.error('Still cannot save after cleanup:', cleanupError);
                            this.showNotification('Storage full. Please delete some old media files.', 'error');
                            // Remove the item we just added
                            this.media.pop();
                            if (callback) callback();
                            return;
                        }
                    } else {
                        throw storageError;
                    }
                }
                
                this.loadMediaGrid();
                console.log('Media grid updated');
                
                console.log(`Successfully uploaded: ${file.name}`);
                if (callback) {
                    console.log('Calling callback for:', file.name);
                    callback();
                }
            } catch (error) {
                console.error('Error processing uploaded file:', error);
                this.showNotification(`Error processing ${file.name}: ${error.message}`, 'error');
                if (callback) callback();
            }
        };
        
        reader.onerror = (error) => {
            console.error('FileReader error for:', file.name, error);
            this.showNotification(`Error reading ${file.name}`, 'error');
            if (callback) callback();
        };
        
        reader.onabort = () => {
            console.error('FileReader aborted for:', file.name);
            this.showNotification(`Upload aborted for ${file.name}`, 'error');
            if (callback) callback();
        };
        
        try {
            reader.readAsDataURL(file);
            console.log(`Started reading file: ${file.name}`);
        } catch (error) {
            console.error('Error starting file read:', error);
            this.showNotification(`Error starting upload for ${file.name}`, 'error');
            if (callback) callback();
        }
    }

    updateUploadProgress(completed, total) {
        const progressBar = document.getElementById('progressBar');
        const uploadCount = document.getElementById('uploadCount');
        
        if (!progressBar || !uploadCount) {
            console.error('Progress elements not found');
            return;
        }
        
        const progress = (completed / total) * 100;
        progressBar.style.width = `${progress}%`;
        uploadCount.textContent = `${completed}/${total}`;
    }

    selectMediaItem(mediaId) {
        const mediaItem = this.media.find(item => item.id === mediaId);
        if (mediaItem) {
            // Copy URL to clipboard
            navigator.clipboard.writeText(mediaItem.url).then(() => {
                this.showNotification('Media URL copied to clipboard!', 'success');
            }).catch(() => {
                this.showNotification('Media selected: ' + mediaItem.name, 'info');
            });
        }
    }

    copyMediaUrl(mediaId) {
        const mediaItem = this.media.find(item => item.id === mediaId);
        if (mediaItem) {
            navigator.clipboard.writeText(mediaItem.url).then(() => {
                this.showNotification('Media URL copied to clipboard!', 'success');
            }).catch(() => {
                this.showNotification('Failed to copy URL', 'error');
            });
        }
    }

    deleteMediaItem(mediaId) {
        const mediaItem = this.media.find(item => item.id === mediaId);
        if (!mediaItem) {
            this.showNotification('Media item not found', 'error');
            return;
        }

        // Check if media is being used in posts
        const isUsedInPosts = this.checkMediaUsage(mediaId);
        let warningMessage = '';
        
        if (isUsedInPosts) {
            warningMessage = '\n\n⚠️ WARNING: This media is currently being used in one or more blog posts. Deleting it may break those posts.';
        }

        // Create a custom confirmation dialog
        const confirmDelete = confirm(`Are you sure you want to delete "${mediaItem.name}"?\n\nThis action cannot be undone and the file will be permanently removed from your media library.${warningMessage}`);
        
        if (confirmDelete) {
            try {
                const index = this.media.findIndex(item => item.id === mediaId);
                if (index !== -1) {
                    const mediaName = this.media[index].name;
                    this.media.splice(index, 1);
                    this.saveMedia();
                    this.loadMediaGrid();
                    this.showNotification(`Media "${mediaName}" deleted successfully`, 'success');
                    
                    // Log deletion for debugging
                    console.log(`Deleted media: ${mediaName} (ID: ${mediaId})`);
                } else {
                    this.showNotification('Media item not found in array', 'error');
                }
            } catch (error) {
                console.error('Error deleting media:', error);
                this.showNotification('Error deleting media file', 'error');
            }
        }
    }

    checkMediaUsage(mediaId) {
        // Check if media is used in any posts
        return this.posts.some(post => {
            // Check featured image
            if (post.featuredImage && post.featuredImage.includes(mediaId)) {
                return true;
            }
            // Check content for media usage
            if (post.content && post.content.includes(mediaId)) {
                return true;
            }
            return false;
        });
    }

    refreshMediaLibrary() {
        this.loadMediaGrid();
        this.showNotification('Media library refreshed', 'success');
    }

    clearStorage() {
        if (confirm('Are you sure you want to clear all media storage? This will permanently delete all uploaded media files and cannot be undone.')) {
            try {
                // Clear media from localStorage
                localStorage.removeItem('blogMedia');
                
                // Clear media array
                this.media = [];
                
                // Reload the grid
                this.loadMediaGrid();
                
                this.showNotification('Storage cleared successfully. All media files have been removed.', 'success');
                console.log('Storage cleared successfully');
            } catch (error) {
                console.error('Error clearing storage:', error);
                this.showNotification('Error clearing storage', 'error');
            }
        }
    }

    handleFeaturedImage(event) {
        try {
            // Check if currentPost exists
            if (!this.currentPost) {
                console.error('No current post available for featured image');
                this.showNotification('Please create or select a post first', 'error');
                return;
            }

            const file = event.target.files[0];
            if (!file) {
                console.warn('No file selected for featured image');
                return;
            }

            if (!file.type.startsWith('image/')) {
                this.showNotification('Please select a valid image file (JPG, PNG, GIF, WebP, SVG)', 'error');
                return;
            }

            // Check file size
            if (file.size > 5 * 1024 * 1024) {
                this.showNotification('Featured image is too large. Please use an image under 5MB.', 'error');
                return;
            }

            console.log(`Processing featured image: ${file.name} (${file.size} bytes)`);

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    // Add watermark to the image
                    this.addWatermarkToImage(e.target.result, (watermarkedImage) => {
                        if (this.currentPost) {
                            this.currentPost.featuredImage = watermarkedImage;
                            this.displayFeaturedImage(watermarkedImage);
                            this.showNotification('Featured image set successfully with watermark', 'success');
                            console.log('Featured image set successfully');
                        } else {
                            console.error('Current post no longer available');
                            this.showNotification('Error setting featured image. Please try again.', 'error');
                        }
                    });
                } catch (error) {
                    console.error('Error processing featured image:', error);
                    this.showNotification('Error processing featured image. Please try again.', 'error');
                }
            };

            reader.onerror = (error) => {
                console.error('Error reading featured image file:', error);
                this.showNotification('Error reading image file. Please try again.', 'error');
            };

            reader.readAsDataURL(file);
            
        } catch (error) {
            console.error('Error handling featured image:', error);
            this.showNotification('Error setting featured image. Please try again.', 'error');
        }
    }

    addWatermarkToImage(imageDataUrl, callback) {
        try {
            if (!imageDataUrl) {
                console.error('No image data provided for watermarking');
                callback(null);
                return;
            }

            const img = new Image();
            
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    if (!ctx) {
                        console.error('Could not get canvas context');
                        callback(null);
                        return;
                    }
                    
                    // Set canvas size to image size
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    // Draw the original image
                    ctx.drawImage(img, 0, 0);
                    
                    // Add watermark text
                    const fontSize = Math.max(16, Math.floor(img.width * 0.03));
                    ctx.font = `bold ${fontSize}px Arial`;
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
                    ctx.lineWidth = 2;
                    
                    // Position watermark in bottom-right corner
                    const text = 'imgtojpg.org';
                    const textMetrics = ctx.measureText(text);
                    const x = img.width - textMetrics.width - 20;
                    const y = img.height - 20;
                    
                    // Draw text with outline
                    ctx.strokeText(text, x, y);
                    ctx.fillText(text, x, y);
                    
                    // Convert back to data URL
                    const watermarkedImage = canvas.toDataURL('image/jpeg', 0.9);
                    console.log('Watermark added successfully');
                    callback(watermarkedImage);
                    
                } catch (error) {
                    console.error('Error adding watermark:', error);
                    callback(null);
                }
            };
            
            img.onerror = (error) => {
                console.error('Error loading image for watermarking:', error);
                callback(null);
            };
            
            img.src = imageDataUrl;
            
        } catch (error) {
            console.error('Error in watermarking process:', error);
            callback(null);
        }
    }

    displayFeaturedImage(imageDataUrl) {
        try {
            if (!imageDataUrl) {
                console.error('No image data provided for display');
                return;
            }

            const preview = document.getElementById('featuredImagePreview');
            const placeholder = document.getElementById('featuredImagePlaceholder');
            const display = document.getElementById('featuredImageDisplay');
            
            if (!preview || !placeholder || !display) {
                console.error('Featured image display elements not found');
                return;
            }
            
            display.src = imageDataUrl;
            preview.classList.remove('hidden');
            placeholder.classList.add('hidden');
            
            console.log('Featured image displayed successfully');
            
        } catch (error) {
            console.error('Error displaying featured image:', error);
        }
    }

    removeFeaturedImage() {
        try {
            // Check if currentPost exists
            if (this.currentPost) {
                this.currentPost.featuredImage = '';
                console.log('Featured image cleared from current post');
            }
            
            const preview = document.getElementById('featuredImagePreview');
            const placeholder = document.getElementById('featuredImagePlaceholder');
            
            if (!preview || !placeholder) {
                console.error('Featured image display elements not found for removal');
                return;
            }
            
            preview.classList.add('hidden');
            placeholder.classList.remove('hidden');
            
            this.showNotification('Featured image removed', 'success');
            console.log('Featured image removed successfully');
            
        } catch (error) {
            console.error('Error removing featured image:', error);
            this.showNotification('Error removing featured image', 'error');
        }
    }

    // Auto-SEO Generation Methods
    autoGenerateTitle() {
        const title = document.getElementById('postTitle').value;
        const content = this.getEditorContent();
        
        if (title) {
            // Generate SEO title from post title
            let seoTitle = title;
            
            // Add brand if not present
            if (!seoTitle.toLowerCase().includes('imgtojpg')) {
                seoTitle += ' - imgtojpg.org';
            }
            
            // Limit length for SEO
            if (seoTitle.length > 60) {
                seoTitle = seoTitle.substring(0, 57) + '...';
            }
            
            document.getElementById('metaTitle').value = seoTitle;
            this.showNotification('SEO title generated successfully', 'success');
        } else {
            this.showNotification('Please enter a post title first', 'error');
        }
    }

    autoGenerateDescription() {
        const content = this.getEditorContent();
        
        if (content && content.length > 50) {
            // Extract first meaningful paragraph
            let description = content.replace(/<[^>]*>/g, '').trim();
            
            // Take first 150 characters
            if (description.length > 150) {
                description = description.substring(0, 147) + '...';
            }
            
            // Clean up multiple spaces and newlines
            description = description.replace(/\s+/g, ' ').trim();
            
            document.getElementById('metaDescription').value = description;
            this.showNotification('SEO description generated successfully', 'success');
        } else {
            this.showNotification('Please add some content to your post first', 'error');
        }
    }

    autoGenerateKeywords() {
        const title = document.getElementById('postTitle').value;
        const content = this.getEditorContent();
        
        if (title || content) {
            let keywords = [];
            
            // Extract keywords from title
            if (title) {
                const titleWords = title.toLowerCase()
                    .replace(/[^\w\s]/g, '')
                    .split(/\s+/)
                    .filter(word => word.length > 3);
                keywords.push(...titleWords);
            }
            
            // Extract keywords from content
            if (content) {
                const contentText = content.replace(/<[^>]*>/g, ' ').toLowerCase();
                const contentWords = contentText
                    .replace(/[^\w\s]/g, '')
                    .split(/\s+/)
                    .filter(word => word.length > 3);
                
                // Get most common words
                const wordCount = {};
                contentWords.forEach(word => {
                    wordCount[word] = (wordCount[word] || 0) + 1;
                });
                
                const commonWords = Object.entries(wordCount)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5)
                    .map(([word]) => word);
                
                keywords.push(...commonWords);
            }
            
            // Add relevant image conversion keywords
            const imageKeywords = ['image conversion', 'jpg', 'png', 'webp', 'heic', 'tiff', 'svg'];
            keywords.push(...imageKeywords);
            
            // Remove duplicates and limit
            const uniqueKeywords = [...new Set(keywords)].slice(0, 10);
            
            document.getElementById('metaKeywords').value = uniqueKeywords.join(', ');
            this.showNotification('SEO keywords generated successfully', 'success');
        } else {
            this.showNotification('Please add some content to your post first', 'error');
        }
    }

    autoGenerateTags() {
        const title = document.getElementById('postTitle').value;
        const content = this.getEditorContent();
        
        if (title || content) {
            let tags = [];
            
            // Extract tags from title
            if (title) {
                const titleWords = title.toLowerCase()
                    .replace(/[^\w\s]/g, '')
                    .split(/\s+/)
                    .filter(word => word.length > 2);
                tags.push(...titleWords);
            }
            
            // Add relevant categories
            const categories = document.getElementById('postCategories').value;
            if (categories) {
                const categoryTags = categories.split(',').map(cat => cat.trim());
                tags.push(...categoryTags);
            }
            
            // Add image conversion related tags
            const imageTags = ['conversion', 'image', 'format', 'tool', 'online'];
            tags.push(...imageTags);
            
            // Remove duplicates and limit
            const uniqueTags = [...new Set(tags)].slice(0, 8);
            
            document.getElementById('postTags').value = uniqueTags.join(', ');
            this.showNotification('Tags generated successfully', 'success');
        } else {
            this.showNotification('Please add some content to your post first', 'error');
        }
    }

    getEditorContent() {
        if (this.quill) {
            return this.quill.root.innerHTML;
        } else {
            // Fallback for textarea
            const editor = document.getElementById('editor');
            return editor ? editor.value : '';
        }
    }

    loadMediaGrid() {
        const mediaGrid = document.getElementById('mediaGrid');
        if (!mediaGrid) return;

        if (this.media.length === 0) {
            mediaGrid.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i class="fas fa-images text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500 text-lg">No media files yet</p>
                    <p class="text-gray-400 text-sm">Upload some images to get started</p>
                </div>
            `;
        } else {
            mediaGrid.innerHTML = this.media.map(item => `
                <div class="media-item bg-white p-4 rounded-lg shadow-sm border cursor-pointer hover:shadow-md" data-media-id="${item.id}">
                    <div class="aspect-square mb-3 overflow-hidden rounded-lg bg-gray-100">
                        <img src="${item.url}" alt="${item.name}" class="w-full h-full object-cover hover:scale-105 transition-transform duration-300">
                    </div>
                    <div class="text-center">
                        <p class="text-sm font-medium text-gray-900 truncate mb-1" title="${item.name}">${item.name}</p>
                        <p class="text-xs text-gray-500 mb-2">${this.formatFileSize(item.size)}</p>
                        <div class="flex justify-center space-x-2">
                            <button class="copy-media-btn text-blue-600 hover:text-blue-800 p-1" title="Copy URL" data-media-id="${item.id}">
                                <i class="fas fa-copy text-xs"></i>
                            </button>
                            <button class="delete-media-btn text-red-600 hover:text-red-800 p-1" title="Delete" data-media-id="${item.id}">
                                <i class="fas fa-trash text-xs"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        // Update storage info
        this.updateStorageInfo();

        // Add event listeners to media items
        this.bindMediaItemEvents();
    }

    updateStorageInfo() {
        const storageUsedElement = document.getElementById('storageUsed');
        const mediaCountElement = document.getElementById('mediaCount');
        
        if (storageUsedElement && mediaCountElement) {
            try {
                const mediaData = JSON.stringify(this.media);
                const dataSize = new Blob([mediaData]).size;
                const dataSizeKB = Math.round(dataSize / 1024);
                
                storageUsedElement.textContent = dataSizeKB;
                mediaCountElement.textContent = this.media.length;
                
                // Add color coding for storage usage
                if (dataSizeKB > 4000) { // > 4MB
                    storageUsedElement.className = 'text-red-600 font-bold';
                } else if (dataSizeKB > 2000) { // > 2MB
                    storageUsedElement.className = 'text-yellow-600 font-bold';
                } else {
                    storageUsedElement.className = 'text-blue-600';
                }
                
                console.log(`Storage info updated: ${dataSizeKB}KB, ${this.media.length} files`);
            } catch (error) {
                console.error('Error updating storage info:', error);
                storageUsedElement.textContent = 'Error';
                mediaCountElement.textContent = 'Error';
            }
        }
    }

    bindMediaItemEvents() {
        console.log('Binding media item events...');
        
        // Media item click (for selection)
        document.querySelectorAll('.media-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    const mediaId = item.dataset.mediaId;
                    console.log('Media item clicked:', mediaId);
                    this.selectMediaItem(mediaId);
                }
            });
        });

        // Copy URL buttons
        const copyButtons = document.querySelectorAll('.copy-media-btn');
        console.log('Found copy buttons:', copyButtons.length);
        copyButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const mediaId = button.dataset.mediaId;
                console.log('Copy button clicked for media:', mediaId);
                this.copyMediaUrl(mediaId);
            });
        });

        // Delete buttons
        const deleteButtons = document.querySelectorAll('.delete-media-btn');
        console.log('Found delete buttons:', deleteButtons.length);
        deleteButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const mediaId = button.dataset.mediaId;
                console.log('Delete button clicked for media:', mediaId);
                this.deleteMediaItem(mediaId);
            });
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    saveSettings() {
        this.settings.blogTitle = document.getElementById('blogTitle').value;
        this.settings.blogDescription = document.getElementById('blogDescription').value;
        this.settings.postsPerPage = document.getElementById('postsPerPage').value;
        this.settings.defaultMetaTitle = document.getElementById('defaultMetaTitle').value;
        this.settings.defaultMetaDescription = document.getElementById('defaultMetaDescription').value;
        this.settings.defaultKeywords = document.getElementById('defaultKeywords').value;

        localStorage.setItem('blogSettings', JSON.stringify(this.settings));
        this.showNotification('Settings saved successfully', 'success');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification bg-${type === 'success' ? 'green' : type === 'error' ? 'red' : 'blue'}-500 text-white px-6 py-3 rounded-lg shadow-lg`;
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} mr-2"></i>
                <span>${message}</span>
            </div>
        `;

        document.getElementById('notificationContainer').appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Data persistence methods
    loadPosts() {
        const stored = localStorage.getItem('blogPosts');
        return stored ? JSON.parse(stored) : [];
    }

    savePosts() {
        try {
            if (!this.posts) {
                console.warn('Posts array is undefined, initializing empty array');
                this.posts = [];
            }
            
            const postsData = JSON.stringify(this.posts);
            console.log(`Saving ${this.posts.length} posts to localStorage`);
            
            localStorage.setItem('blogPosts', postsData);
            console.log('Posts saved successfully to localStorage');
            
        } catch (error) {
            console.error('Error saving posts:', error);
            
            if (error.name === 'QuotaExceededError') {
                this.showNotification('Storage full. Please delete some old posts.', 'error');
            } else {
                this.showNotification('Error saving posts. Please try again.', 'error');
            }
            
            throw error;
        }
    }

    loadCategories() {
        const stored = localStorage.getItem('blogCategories');
        return stored ? JSON.parse(stored) : [
            { id: 1, name: 'General', description: 'General blog posts', postCount: 0, createdAt: new Date().toISOString() },
            { id: 2, name: 'Image Conversion', description: 'Posts about image conversion', postCount: 0, createdAt: new Date().toISOString() },
            { id: 3, name: 'Tutorials', description: 'How-to guides and tutorials', postCount: 0, createdAt: new Date().toISOString() }
        ];
    }

    saveCategories() {
        localStorage.setItem('blogCategories', JSON.stringify(this.categories));
    }

    loadMedia() {
        const stored = localStorage.getItem('blogMedia');
        return stored ? JSON.parse(stored) : [];
    }

    saveMedia() {
        try {
            const mediaData = JSON.stringify(this.media);
            const dataSize = new Blob([mediaData]).size;
            console.log(`Saving media data: ${this.media.length} items, ${Math.round(dataSize/1024)}KB`);
            
            localStorage.setItem('blogMedia', mediaData);
            console.log('Media saved successfully');
        } catch (error) {
            console.error('Error saving media:', error);
            
            if (error.name === 'QuotaExceededError') {
                console.warn('localStorage quota exceeded, attempting cleanup...');
                this.cleanupOldMedia();
                
                // Try to save again after cleanup
                try {
                    const mediaData = JSON.stringify(this.media);
                    localStorage.setItem('blogMedia', mediaData);
                    console.log('Media saved after cleanup');
                } catch (cleanupError) {
                    console.error('Still cannot save after cleanup:', cleanupError);
                    throw new Error('Storage full. Please delete some old media files manually.');
                }
            } else {
                throw error;
            }
        }
    }

    loadSettings() {
        const stored = localStorage.getItem('blogSettings');
        return stored ? JSON.parse(stored) : {
            blogTitle: 'imgtojpg.org Blog',
            blogDescription: 'Professional image conversion service blog',
            postsPerPage: 10,
            defaultMetaTitle: '',
            defaultMetaDescription: '',
            defaultKeywords: ''
        };
    }
}

// Initialize blog manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.blogManager = new BlogManager();
});

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlogManager;
}
