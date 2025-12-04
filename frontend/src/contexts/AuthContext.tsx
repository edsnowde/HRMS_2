import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  signInWithEmailAndPassword, 
  signInWithPopup,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged, 
  signOut, 
  User as FirebaseUser, 
  getIdTokenResult 
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

export type UserRole = 'admin' | 'hr' | 'recruiter' | 'employee' | 'candidate';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  idToken: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  // login optionally accepts a selectedRole chosen by the user at login time.
  login: (email: string, password: string, selectedRole?: UserRole) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  // allow explicit login with a role (used when user selects role during login)
  loginWithRole: (email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function extractRoleFromFirebaseUser(fbUser: FirebaseUser): Promise<UserRole> {
  try {
    const tokenResult = await getIdTokenResult(fbUser, true);
    const claims = tokenResult.claims;
    return (claims.role as UserRole) || 'candidate';
  } catch (error) {
    console.warn('Failed to get custom claims, defaulting to candidate role:', error);
    return 'candidate';
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Persisted role override (when an end-user selects a role at login)
  useEffect(() => {
    const storedRole = localStorage.getItem('auralis:selectedRole');
    if (storedRole && user && user.role !== storedRole) {
      // if there's a logged-in user and a stored role, prefer stored role
      setUser((u) => (u ? { ...u, role: storedRole as UserRole } : u));
    }
  }, [user]);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        try {
          const token = await fbUser.getIdToken();
          const role = await extractRoleFromFirebaseUser(fbUser);
          setUser({
            id: fbUser.uid,
            email: fbUser.email || '',
            name: fbUser.displayName || fbUser.email?.split('@')[0] || '',
            role,
            idToken: token,
          });
          // Persist token for api client (dev convenience). Remove in logout.
          try { localStorage.setItem('auralis:idToken', token); } catch (e) { /* ignore */ }
        } catch (error) {
          console.error('Error setting user:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    // default login preserves existing behaviour but will also respect a stored override
    setIsLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const fbUser = cred.user;
      const token = await fbUser.getIdToken();
      let role = await extractRoleFromFirebaseUser(fbUser);
      const storedRole = localStorage.getItem('auralis:selectedRole') as UserRole | null;
      if (storedRole) {
        role = storedRole;
      }
      setUser({
        id: fbUser.uid,
        email: fbUser.email || '',
        name: fbUser.displayName || fbUser.email?.split('@')[0] || '',
        role,
        idToken: token,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithRole = async (email: string, password: string, role: UserRole) => {
    // store selected role so it can be used as an override if Firebase custom claims are not set
    localStorage.setItem('auralis:selectedRole', role);
    await login(email, password);
  };

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const token = await fbUser.getIdToken();
      let role = await extractRoleFromFirebaseUser(fbUser);
      const storedRole = localStorage.getItem('auralis:selectedRole') as UserRole | null;
      if (storedRole) role = storedRole;
      setUser({
        id: fbUser.uid,
        email: fbUser.email || '',
        name: fbUser.displayName || fbUser.email?.split('@')[0] || '',
        role,
        idToken: token,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const fbUser = cred.user;
      
      // Update display name first
      await updateProfile(fbUser, { displayName: name });
      
      // Force a fresh token
      const token = await fbUser.getIdToken(true);
      const role = await extractRoleFromFirebaseUser(fbUser);
      
      // Important: Set token in localStorage before updating user state
      try {
        localStorage.setItem('auralis:idToken', token);
        console.log('Token stored successfully:', token.slice(0, 10) + '...');
      } catch (e) {
        console.error('Failed to store token:', e);
        throw new Error('Failed to store authentication token');
      }
      
      // Update user state with verified token
      setUser({
        id: fbUser.uid,
        email: fbUser.email || '',
        name: fbUser.displayName || name,
        role,
        idToken: token,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // sign out from Firebase and clear local auth state + stored overrides
    signOut(auth).catch((e) => console.warn('Sign out error:', e));
    setUser(null);
    try { localStorage.removeItem('auralis:idToken'); } catch (e) { /* ignore */ }
    try { localStorage.removeItem('auralis:selectedRole'); } catch (e) { /* ignore */ }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token: user?.idToken || null,
        login,
        loginWithGoogle,
        signup,
        loginWithRole,
        logout,
        isAuthenticated: !!user,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};