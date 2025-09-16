// Blog Integration Script - Connects Blog Manager to Main Website
class BlogIntegration {
    constructor() {
        this.posts = [];
        this.categories = [];
        this.init();
    }

    init() {
        console.log('Blog Integration initializing...');
        this.loadBlogData();
        this.renderBlogPosts();
        this.setupEventListeners();
        console.log('Blog Integration ready');
    }

    loadBlogData() {
        try {
            // Load posts from blog manager
            const storedPosts = localStorage.getItem('blogPosts');
            if (storedPosts) {
                this.posts = JSON.parse(storedPosts);
                console.log(`Loaded ${this.posts.length} posts from blog manager`);
            }

            // Load categories from blog manager
            const storedCategories = localStorage.getItem('blogCategories');
            if (storedCategories) {
                this.categories = JSON.parse(storedCategories);
                console.log(`Loaded ${this.categories.length} categories from blog manager`);
            }

            // Filter only published posts
            this.posts = this.posts.filter(post => post.status === 'published');
            console.log(`${this.posts.length} published posts found`);
        } catch (error) {
            console.error('Error loading blog data:', error);
            this.posts = [];
            this.categories = [];
        }
    }

    renderBlogPosts() {
        const blogContainer = document.getElementById('blogPostsContainer');
        if (!blogContainer) {
            console.error('Blog posts container not found');
            return;
        }

        if (this.posts.length === 0) {
            // Show default posts if no blog manager posts exist
            this.showDefaultPosts();
            return;
        }

        // Sort posts by publish date (newest first)
        const sortedPosts = this.posts.sort((a, b) => 
            new Date(b.publishDate || b.createdAt) - new Date(a.publishDate || a.createdAt)
        );

        // Render blog manager posts
        blogContainer.innerHTML = sortedPosts.map(post => this.createPostHTML(post)).join('');
        
        // Add admin link if posts exist
        this.addAdminLink();
    }

    createPostHTML(post) {
        const publishDate = new Date(post.publishDate || post.createdAt);
        const formattedDate = publishDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Extract categories and tags
        const postCategories = post.categories ? post.categories.split(',').map(cat => cat.trim()) : [];
        const postTags = post.tags ? post.tags.split(',').map(tag => tag.trim()) : [];

        // Create category and tag HTML
        const categoriesHTML = postCategories.map(cat => 
            `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">${cat}</span>`
        ).join('');

        const tagsHTML = postTags.map(tag => 
            `<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">${tag}</span>`
        ).join('');

        // Get excerpt from content (remove HTML tags and limit length)
        const excerpt = this.getExcerpt(post.content, 200);

        // Generate icon based on first category or use default
        const icon = this.getCategoryIcon(postCategories[0] || 'general');

        return `
            <div class="adobe-card p-6 mb-8 hover-fade-up cursor-pointer" onclick="window.open('/blog-post.html?id=${post.id}', '_blank')">
                <div class="flex flex-col lg:flex-row gap-6">
                    <div class="lg:w-1/3">
                        ${post.featuredImage ? `
                            <div class="bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg overflow-hidden">
                                <img src="${post.featuredImage}" alt="${post.title || 'Blog Post'}" class="w-full h-48 object-cover">
                                <div class="p-4 text-center">
                                    <p class="text-sm text-gray-600">${postCategories[0] || 'Blog Post'}</p>
                                </div>
                            </div>
                        ` : `
                            <div class="bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg p-8 text-center">
                                <div class="text-4xl mb-4 hover-pulse">${icon}</div>
                                <p class="text-sm text-gray-600">${postCategories[0] || 'Blog Post'}</p>
                            </div>
                        `}
                    </div>
                    <div class="lg:w-2/3">
                        <h3 class="text-xl font-semibold text-gray-900 mb-3">${post.title || 'Untitled Post'}</h3>
                        <p class="text-gray-600 mb-4">${excerpt}</p>
                        <div class="flex flex-wrap gap-2 mb-4">
                            ${categoriesHTML}
                            ${tagsHTML}
                        </div>
                        <p class="text-sm text-gray-500">Published on ${formattedDate}</p>
                        <div class="mt-4">
                            <span class="text-blue-600 font-medium hover:text-blue-800 transition-colors">Read More →</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getExcerpt(content, maxLength) {
        if (!content) return 'No content available.';
        
        // Remove HTML tags
        const textContent = content.replace(/<[^>]*>/g, '');
        
        if (textContent.length <= maxLength) {
            return textContent;
        }
        
        return textContent.substring(0, maxLength) + '...';
    }

    getCategoryIcon(category) {
        const iconMap = {
            'image conversion': '🖼️',
            'photography': '📷',
            'tutorials': '📚',
            'tips': '💡',
            'heic': '📱',
            'png': '🖼️',
            'webp': '🌐',
            'tiff': '📄',
            'raw': '📸',
            'general': '📝'
        };

        if (!category) return '📝';
        
        const lowerCategory = category.toLowerCase();
        for (const [key, icon] of Object.entries(iconMap)) {
            if (lowerCategory.includes(key)) {
                return icon;
            }
        }
        
        return '📝';
    }

    showDefaultPosts() {
        const blogContainer = document.getElementById('blogPostsContainer');
        if (!blogContainer) return;

        // Show the existing default posts
        blogContainer.innerHTML = `
            <!-- Blog Post 1: HEIC to JPG Guide -->
            <div class="adobe-card p-6 mb-8 hover-fade-up cursor-pointer" onclick="openBlogPost('heic-guide')">
                <div class="flex flex-col lg:flex-row gap-6">
                    <div class="lg:w-1/3">
                        <div class="bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg p-8 text-center">
                            <div class="text-4xl mb-4 hover-pulse">📱</div>
                            <p class="text-sm text-gray-600">HEIC Conversion</p>
                        </div>
                    </div>
                    <div class="lg:w-2/3">
                        <h3 class="text-xl font-semibold text-gray-900 mb-3">Complete Guide: Converting HEIC to JPG</h3>
                        <p class="text-gray-600 mb-4">
                            Learn everything about HEIC files and how to convert them to JPG format. HEIC (High Efficiency Image Container) is Apple's modern image format that offers better compression than JPEG while maintaining quality.
                        </p>
                        <div class="flex flex-wrap gap-2 mb-4">
                            <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">heic</span>
                            <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">conversion</span>
                            <span class="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">tutorial</span>
                        </div>
                        <p class="text-sm text-gray-500">Published on January 15, 2025</p>
                        <div class="mt-4">
                            <span class="text-blue-600 font-medium hover:text-blue-800 transition-colors">Read More →</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Blog Post 2: Image Format Comparison -->
            <div class="adobe-card p-6 mb-8 hover-fade-up cursor-pointer" onclick="openBlogPost('format-comparison')">
                <div class="flex flex-col lg:flex-row gap-6">
                    <div class="lg:w-1/3">
                        <div class="bg-gradient-to-br from-green-100 to-blue-100 rounded-lg p-8 text-center">
                            <div class="text-4xl mb-4 hover-pulse">🖼️</div>
                            <p class="text-sm text-gray-600">Format Guide</p>
                        </div>
                    </div>
                    <div class="lg:w-2/3">
                        <h3 class="text-xl font-semibold text-gray-900 mb-3">JPG vs PNG vs WebP: Which Format Should You Use?</h3>
                        <p class="text-gray-600 mb-4">
                            Understanding the differences between popular image formats can help you choose the right one for your needs. Each format has its strengths and ideal use cases.
                        </p>
                        <div class="flex flex-wrap gap-2 mb-4">
                            <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">formats</span>
                            <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">comparison</span>
                            <span class="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">guide</span>
                        </div>
                        <p class="text-sm text-gray-500">Published on January 12, 2025</p>
                        <div class="mt-4">
                            <span class="text-blue-600 font-medium hover:text-blue-800 transition-colors">Read More →</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    addAdminLink() {
        const blogHeader = document.querySelector('.container-responsive.text-center');
        if (blogHeader && !document.getElementById('adminLink')) {
            const adminLink = document.createElement('div');
            adminLink.className = 'mt-6';
            adminLink.innerHTML = `
                <a href="/blog-manager.html" class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    Manage Blog Posts
                </a>
            `;
            blogHeader.appendChild(adminLink);
        }
    }

    openBlogPost(postId) {
        const post = this.posts.find(p => p.id == postId);
        if (!post) {
            console.error('Post not found:', postId);
            return;
        }

        // Create modal content
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');
        const blogModal = document.getElementById('blogModal');

        if (modalTitle && modalContent && blogModal) {
            modalTitle.textContent = post.title || 'Untitled Post';
            modalContent.innerHTML = post.content || '<p>No content available.</p>';
            blogModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }

    setupEventListeners() {
        // Listen for storage changes (when posts are updated in blog manager)
        window.addEventListener('storage', (e) => {
            if (e.key === 'blogPosts' || e.key === 'blogCategories') {
                console.log('Blog data updated, refreshing...');
                this.loadBlogData();
                this.renderBlogPosts();
            }
        });

        // Refresh data every 30 seconds to catch updates
        setInterval(() => {
            this.loadBlogData();
            this.renderBlogPosts();
        }, 30000);
    }

    // Public method to refresh blog data
    refresh() {
        this.loadBlogData();
        this.renderBlogPosts();
    }
}

// Initialize blog integration when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.blogIntegration = new BlogIntegration();
});

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlogIntegration;
}
