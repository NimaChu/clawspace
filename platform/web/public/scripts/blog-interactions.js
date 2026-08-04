// Blog Interactions Script
// Handles pagination, tag filtering, and search functionality

class BlogInteractions {
  constructor() {
    this.posts = [];
    this.filteredPosts = [];
    this.currentPage = 1;
    this.postsPerPage = 6;
    this.currentTag = null;
    this.currentYear = null;

    // Get all posts from the DOM
    this.collectPosts();

    // Initialize event listeners
    this.initEventListeners();

    // Initialize pagination
    this.renderPagination();
  }

  collectPosts() {
    const postElements = document.querySelectorAll('#blog-posts-container article');
    this.posts = Array.from(postElements).map(article => {
      const tags = article.getAttribute('data-tags')?.split(',') || [];
      return {
        element: article,
        tags: tags,
        year: new Date(article.querySelector('time').textContent).getFullYear()
      };
    });
    this.filteredPosts = [...this.posts];
  }

  initEventListeners() {
    // Handle tag clicks
    const tagLinks = document.querySelectorAll('.bg-blue-100[href^="/blog?tag="]');
    tagLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tag = new URL(link.href).searchParams.get('tag');
        this.filterByTag(tag);
      });
    });

    // Handle year clicks
    const yearLinks = document.querySelectorAll('a[href^="/blog?year="]');
    yearLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const year = new URL(link.href).searchParams.get('year');
        this.filterByYear(year);
      });
    });

    // Handle pagination clicks (will be added dynamically)
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-page]')) {
        e.preventDefault();
        const page = parseInt(e.target.getAttribute('data-page'));
        this.goToPage(page);
      }
    });

    // Handle URL parameters on page load
    this.handleUrlParameters();
  }

  handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const tagParam = urlParams.get('tag');
    const yearParam = urlParams.get('year');

    if (tagParam) {
      this.filterByTag(tagParam);
    } else if (yearParam) {
      this.filterByYear(yearParam);
    }
  }

  filterByTag(tag) {
    this.currentTag = tag;
    this.currentYear = null;
    this.currentPage = 1;

    if (tag === null) {
      this.filteredPosts = [...this.posts];
    } else {
      this.filteredPosts = this.posts.filter(post =>
        post.tags.includes(tag)
      );
    }

    this.updateUrlParameter('tag', tag);
    this.renderPosts();
    this.renderPagination();
  }

  filterByYear(year) {
    this.currentYear = year;
    this.currentTag = null;
    this.currentPage = 1;

    if (year === null) {
      this.filteredPosts = [...this.posts];
    } else {
      this.filteredPosts = this.posts.filter(post =>
        post.year.toString() === year
      );
    }

    this.updateUrlParameter('year', year);
    this.renderPosts();
    this.renderPagination();
  }

  updateUrlParameter(param, value) {
    const url = new URL(window.location);
    url.searchParams.delete('tag');
    url.searchParams.delete('year');

    if (value !== null) {
      url.searchParams.set(param, value);
    }

    window.history.replaceState({}, '', url);
  }

  renderPosts() {
    const container = document.getElementById('blog-posts-container');
    const startIndex = (this.currentPage - 1) * this.postsPerPage;
    const endIndex = startIndex + this.postsPerPage;
    const postsToShow = this.filteredPosts.slice(startIndex, endIndex);

    // Clear container
    container.innerHTML = '';

    // Add posts back
    postsToShow.forEach(postData => {
      container.appendChild(postData.element);
    });

    // Show/hide "no results" message
    if (this.filteredPosts.length === 0) {
      container.innerHTML = '<p class="text-center text-gray-500 py-8">没有找到匹配的文章</p>';
    }
  }

  renderPagination() {
    const totalPages = Math.ceil(this.filteredPosts.length / this.postsPerPage);
    const container = document.getElementById('pagination-container');

    if (totalPages <= 1) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    const nav = container.querySelector('nav');
    nav.innerHTML = '';

    // Previous button
    if (this.currentPage > 1) {
      const prevBtn = document.createElement('button');
      prevBtn.textContent = '上一页';
      prevBtn.setAttribute('data-page', this.currentPage - 1);
      prevBtn.className = 'px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors';
      nav.appendChild(prevBtn);
    }

    // Page numbers
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(totalPages, this.currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.textContent = i;
      pageBtn.setAttribute('data-page', i);
      if (i === this.currentPage) {
        pageBtn.className = 'px-4 py-2 bg-blue-600 text-white rounded-lg';
      } else {
        pageBtn.className = 'px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors';
      }
      nav.appendChild(pageBtn);
    }

    // Next button
    if (this.currentPage < totalPages) {
      const nextBtn = document.createElement('button');
      nextBtn.textContent = '下一页';
      nextBtn.setAttribute('data-page', this.currentPage + 1);
      nextBtn.className = 'px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors';
      nav.appendChild(nextBtn);
    }
  }

  goToPage(page) {
    this.currentPage = page;
    this.renderPosts();
    this.renderPagination();

    // Scroll to top of posts container
    document.getElementById('blog-posts-container').scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new BlogInteractions();
});