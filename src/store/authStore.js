import { create } from 'zustand';

const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  loading: true,

  init: () => {
    try {
      const token = localStorage.getItem('meiou_token');
      const userStr = localStorage.getItem('meiou_user');
      const user = userStr ? JSON.parse(userStr) : null;
      set({ user, token, loading: false });
    } catch {
      localStorage.removeItem('meiou_token');
      localStorage.removeItem('meiou_user');
      set({ user: null, token: null, loading: false });
    }
  },

  login: (user, token) => {
    localStorage.setItem('meiou_token', token);
    localStorage.setItem('meiou_user', JSON.stringify(user));
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem('meiou_token');
    localStorage.removeItem('meiou_user');
    set({ user: null, token: null });
  },

  isAdmin: () => {
    return get().user?.role === 'admin';
  },

  hasMenu: (menuKey) => {
    const menus = get().user?.menus || [];
    return menus.includes(menuKey);
  },

  hasPermission: (permKey) => {
    const permissions = get().user?.permissions || [];
    return permissions.includes(permKey);
  },
}));

export default useAuthStore;