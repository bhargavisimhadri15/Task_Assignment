import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_URL } from '../config';
import { 
  Plus, 
  MagnifyingGlass, 
  PencilSimple, 
  Trash, 
  SignOut, 
  User,
  CaretLeft,
  CaretRight,
  X
} from '@phosphor-icons/react';

// Post Card Component
const PostCard = React.memo(({ post, currentUserId, onView, onEdit, onDelete }) => {
  const isOwner = post.userId === currentUserId;
  const category = (post.category || 'general').toUpperCase();
  
  return (
    <div
      data-testid="post-card-container"
      onClick={() => onView(post)}
      className="card-brutalist p-6 flex flex-col h-full cursor-pointer hover:bg-gray-50 transition-colors"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onView(post);
      }}
    >
      <div className="flex-1">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-xl font-bold uppercase tracking-tight line-clamp-2">
            {post.title}
          </h3>
          <span className="shrink-0 px-2 py-1 border-2 border-black text-[10px] font-black uppercase tracking-widest bg-white">
            {category}
          </span>
        </div>
        <p className="text-gray-600 text-sm leading-relaxed line-clamp-4 mb-4">
          {post.body}
        </p>
      </div>
      
      <div className="mt-auto pt-4 border-t-2 border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-200 border-2 border-black flex items-center justify-center">
              <User size={16} weight="bold" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase">{post.userName}</p>
              <p className="text-xs text-gray-500">
                {new Date(post.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          {isOwner && (
            <div className="flex gap-2">
              <button
                data-testid="post-edit-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(post);
                }}
                className="p-2 border-2 border-black hover:bg-blue-600 hover:border-blue-600 hover:text-white transition-colors"
                title="Edit post"
              >
                <PencilSimple size={16} weight="bold" />
              </button>
              <button
                data-testid="post-delete-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(post);
                }}
                className="p-2 border-2 border-black hover:bg-red-500 hover:border-red-500 hover:text-white transition-colors"
                title="Delete post"
              >
                <Trash size={16} weight="bold" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// Modal Component
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="modal-brutalist relative w-full max-w-lg mx-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-black">
          <h2 className="text-2xl font-black uppercase tracking-tight">{title}</h2>
          <button
            data-testid="modal-close-button"
            onClick={onClose}
            className="p-2 border-2 border-black hover:bg-black hover:text-white transition-colors"
          >
            <X size={20} weight="bold" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [viewPost, setViewPost] = useState(null);
  
  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formCategory, setFormCategory] = useState('general');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 12 });
      if (search) params.append('search', search);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      
      const response = await axios.get(`${API_URL}/api/posts?${params}`);
      setPosts(response.data.posts);
      setTotalPages(response.data.totalPages);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Default filter = All on mount
  useEffect(() => {
    setCategoryFilter('all');
  }, []);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Category filter -> reset to page 1
  useEffect(() => {
    setPage(1);
  }, [categoryFilter]);

  const handleCreatePost = useCallback(async (e) => {
    e.preventDefault();
    if (!formTitle.trim() || !formBody.trim()) return;
    
    setFormLoading(true);
    setFormError('');
    try {
      const categoryFromForm = e.currentTarget?.querySelector?.('[data-testid="post-category-select"]')?.value;
      const createdCategory = categoryFromForm || formCategory;
      await axios.post(`${API_URL}/api/posts`, {
        title: formTitle,
        body: formBody,
        category: createdCategory
      });
      setShowCreateModal(false);
      setFormTitle('');
      setFormBody('');
      setFormCategory('general');
      if (categoryFilter === createdCategory) {
        fetchPosts();
      } else {
        setCategoryFilter(createdCategory);
      }
    } catch (error) {
      setFormError(error.response?.data?.detail || 'Failed to create post');
    } finally {
      setFormLoading(false);
    }
  }, [formTitle, formBody, formCategory, categoryFilter, fetchPosts]);

  const handleEditPost = useCallback(async (e) => {
    e.preventDefault();
    if (!selectedPost || !formTitle.trim() || !formBody.trim()) return;
    
    setFormLoading(true);
    setFormError('');
    try {
      const categoryFromForm = e.currentTarget?.querySelector?.('[data-testid="edit-post-category-select"]')?.value;
      const updatedCategory = categoryFromForm || formCategory;
      await axios.put(`${API_URL}/api/posts/${selectedPost.id}`, {
        title: formTitle,
        body: formBody,
        category: updatedCategory
      });
      setShowEditModal(false);
      setSelectedPost(null);
      setFormTitle('');
      setFormBody('');
      setFormCategory('general');
      if (categoryFilter === updatedCategory) {
        fetchPosts();
      } else {
        setCategoryFilter(updatedCategory);
      }
    } catch (error) {
      setFormError(error.response?.data?.detail || 'Failed to update post');
    } finally {
      setFormLoading(false);
    }
  }, [selectedPost, formTitle, formBody, formCategory, categoryFilter, fetchPosts]);

  const handleDeletePost = useCallback(async () => {
    if (!selectedPost) return;
    
    setFormLoading(true);
    try {
      await axios.delete(`${API_URL}/api/posts/${selectedPost.id}`);
      setShowDeleteModal(false);
      setSelectedPost(null);
      fetchPosts();
    } catch (error) {
      console.error('Failed to delete post:', error);
    } finally {
      setFormLoading(false);
    }
  }, [selectedPost, fetchPosts]);

  const openEditModal = useCallback((post) => {
    setSelectedPost(post);
    setFormTitle(post.title);
    setFormBody(post.body);
    setFormCategory(post.category || 'general');
    setFormError('');
    setShowEditModal(true);
  }, []);

  const openDeleteModal = useCallback((post) => {
    setSelectedPost(post);
    setShowDeleteModal(true);
  }, []);

  const openViewModal = useCallback((post) => {
    setViewPost(post);
    setShowViewModal(true);
  }, []);

  const openCreateModal = useCallback(() => {
    setFormTitle('');
    setFormBody('');
    setFormCategory(categoryFilter !== 'all' ? categoryFilter : 'general');
    setFormError('');
    setShowCreateModal(true);
  }, [categoryFilter]);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const goToProfile = useCallback(() => {
    navigate('/profile');
  }, [navigate]);

  // Memoized pagination info
  const paginationInfo = useMemo(() => {
    const start = (page - 1) * 12 + 1;
    const end = Math.min(page * 12, total);
    return { start, end };
  }, [page, total]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b-4 border-black bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter">TASK MANAGER</h1>
              <p className="text-xs text-gray-600 font-medium uppercase tracking-wider">Post Management Dashboard</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 px-4 py-2 border-2 border-black">
                <div className="w-8 h-8 bg-blue-600 flex items-center justify-center text-white font-bold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-bold">{user?.name}</p>
                  <p className="text-xs text-gray-500 uppercase">{user?.role}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={goToProfile}
                className="btn-brutalist flex items-center gap-2"
              >
                PROFILE
              </button>
              
              <button
                data-testid="logout-button"
                onClick={handleLogout}
                className="btn-brutalist flex items-center gap-2"
              >
                <SignOut size={20} weight="bold" />
                <span className="hidden sm:inline">LOGOUT</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <MagnifyingGlass 
              size={20} 
              weight="bold" 
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              data-testid="search-input"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search posts by title..."
              className="w-full pl-12 pr-4 py-3 bg-white"
            />
          </div>

          <select
            data-testid="category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-3 bg-white border-2 border-black font-bold uppercase tracking-widest text-xs"
          >
            <option value="all">All</option>
            <option value="general">General</option>
            <option value="technology">Technology</option>
          </select>
          
          <button
            data-testid="create-post-button"
            onClick={openCreateModal}
            className="btn-brutalist btn-brutalist-primary flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Plus size={20} weight="bold" />
            CREATE POST
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="card-brutalist p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Total Posts</p>
            <p className="text-3xl font-black">{total}</p>
          </div>
          <div className="card-brutalist p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Current Page</p>
            <p className="text-3xl font-black">{page}</p>
          </div>
          <div className="card-brutalist p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Total Pages</p>
            <p className="text-3xl font-black">{totalPages}</p>
          </div>
          <div className="card-brutalist p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Your Posts</p>
            <p className="text-3xl font-black">
              {posts.filter(p => p.userId === user?.id).length}
            </p>
          </div>
        </div>

        {/* Posts Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-xl font-bold uppercase loading-brutalist">LOADING POSTS...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-64 h-64 border-4 border-black bg-gray-50 flex items-center justify-center mb-8">
              <p className="text-6xl font-black">0</p>
            </div>
            <h3 className="text-2xl font-black uppercase mb-2">NO POSTS FOUND</h3>
            <p className="text-gray-600 mb-6">
              {search ? 'Try a different search term' : 'Create your first post to get started'}
            </p>
            {!search && (
              <button
                onClick={openCreateModal}
                className="btn-brutalist btn-brutalist-primary flex items-center gap-2"
              >
                <Plus size={20} weight="bold" />
                CREATE POST
              </button>
            )}
          </div>
        ) : (
          <>
            <div data-testid="posts-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={user?.id}
                  onView={openViewModal}
                  onEdit={openEditModal}
                  onDelete={openDeleteModal}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-8 border-t-2 border-black">
                <p className="text-sm font-medium">
                  Showing {paginationInfo.start} - {paginationInfo.end} of {total} posts
                </p>
                
                <div className="flex items-center gap-2">
                  <button
                    data-testid="prev-page-button"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-brutalist flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CaretLeft size={16} weight="bold" />
                    PREV
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          data-testid={`page-button-${pageNum}`}
                          onClick={() => setPage(pageNum)}
                          className={`w-10 h-10 border-2 border-black font-bold transition-colors ${
                            page === pageNum
                              ? 'bg-black text-white'
                              : 'bg-white hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    data-testid="next-page-button"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn-brutalist flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    NEXT
                    <CaretRight size={16} weight="bold" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Create Post Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Post"
      >
        <form onSubmit={handleCreatePost} className="space-y-6">
          {formError && (
            <div className="p-4 border-2 border-red-500 bg-red-50 text-red-700 font-medium">
              {formError}
            </div>
          )}
          
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2">
              Category
            </label>
            <select
              data-testid="post-category-select"
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-black font-bold uppercase tracking-widest text-xs"
            >
              <option value="general">General</option>
              <option value="technology">Technology</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2">
              Title
            </label>
            <input
              data-testid="post-title-input"
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Enter post title"
              className="w-full px-4 py-3"
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2">
              Body
            </label>
            <textarea
              data-testid="post-body-input"
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              placeholder="Enter post content"
              rows={5}
              className="w-full px-4 py-3 resize-none"
              required
            />
          </div>
          
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="flex-1 btn-brutalist"
            >
              CANCEL
            </button>
            <button
              data-testid="submit-post-button"
              type="submit"
              disabled={formLoading || !formTitle.trim() || !formBody.trim()}
              className="flex-1 btn-brutalist btn-brutalist-primary disabled:opacity-50"
            >
              {formLoading ? 'CREATING...' : 'CREATE POST'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Post Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Post"
      >
        <form onSubmit={handleEditPost} className="space-y-6">
          {formError && (
            <div className="p-4 border-2 border-red-500 bg-red-50 text-red-700 font-medium">
              {formError}
            </div>
          )}
          
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2">
              Category
            </label>
            <select
              data-testid="edit-post-category-select"
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-black font-bold uppercase tracking-widest text-xs"
            >
              <option value="general">General</option>
              <option value="technology">Technology</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2">
              Title
            </label>
            <input
              data-testid="edit-post-title-input"
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Enter post title"
              className="w-full px-4 py-3"
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2">
              Body
            </label>
            <textarea
              data-testid="edit-post-body-input"
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              placeholder="Enter post content"
              rows={5}
              className="w-full px-4 py-3 resize-none"
              required
            />
          </div>
          
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="flex-1 btn-brutalist"
            >
              CANCEL
            </button>
            <button
              data-testid="update-post-button"
              type="submit"
              disabled={formLoading || !formTitle.trim() || !formBody.trim()}
              className="flex-1 btn-brutalist btn-brutalist-primary disabled:opacity-50"
            >
              {formLoading ? 'UPDATING...' : 'UPDATE POST'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Post"
      >
        <div className="space-y-6">
          <div className="p-4 border-2 border-yellow-500 bg-yellow-50">
            <p className="font-medium">
              Are you sure you want to delete this post? This action cannot be undone.
            </p>
            {selectedPost && (
              <p className="mt-2 text-sm text-gray-600">
                Post: <strong>{selectedPost.title}</strong>
              </p>
            )}
          </div>
          
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              className="flex-1 btn-brutalist"
            >
              CANCEL
            </button>
            <button
              data-testid="confirm-delete-button"
              onClick={handleDeletePost}
              disabled={formLoading}
              className="flex-1 btn-brutalist btn-brutalist-danger disabled:opacity-50"
            >
              {formLoading ? 'DELETING...' : 'DELETE POST'}
            </button>
          </div>
        </div>
      </Modal>

      {/* View Post Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title="Post Details"
      >
        {viewPost && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h3 className="text-2xl font-black uppercase tracking-tight mb-2">
                  {viewPost.title}
                </h3>
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-gray-600">
                  <span className="px-2 py-1 border-2 border-black bg-white text-black">
                    {(viewPost.category || 'general').toUpperCase()}
                  </span>
                  <span>{viewPost.userName}</span>
                  <span>{viewPost.createdAt ? new Date(viewPost.createdAt).toLocaleString() : ''}</span>
                </div>
              </div>
            </div>

            <div className="border-2 border-black bg-white p-4">
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {viewPost.body}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowViewModal(false)}
              className="w-full btn-brutalist"
            >
              CLOSE
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
