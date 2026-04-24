import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, buttonVariants } from '@/components/ui/button';
import { Hammer, LogIn, LogOut, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './ThemeToggle';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Navbar() {
  const { user, isVerified, signOut } = useAuth();
  const navigate = useNavigate();
  const [siteName, setSiteName] = useState('RX ELITE');

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'config'), (doc) => {
      if (doc.exists()) {
        setSiteName(doc.data().siteName || 'RX ELITE');
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <nav className="border-b border-border/40 bg-background/70 sticky top-0 z-50 backdrop-blur-xl">
      <div className="container mx-auto px-6 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group no-underline">
          <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-xl group-hover:bg-primary/20 transition-all duration-500 ring-1 ring-primary/20">
            <Hammer className="w-6 h-6 text-primary" />
          </div>
          <span className="text-2xl font-black tracking-tighter text-foreground transition-colors">{siteName}</span>
        </Link>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          
          <div className="h-8 w-[1px] bg-border/50 mx-1 hidden md:block" />

          {user && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="hidden lg:flex items-center"
              >
                {isVerified ? (
                  <Badge variant="secondary" className="gap-2 bg-green-500/10 text-green-600 hover:bg-green-500/20 border-none px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
                    <ShieldCheck className="w-4 h-4" />
                    Elite verified
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-2 bg-destructive/10 text-destructive hover:bg-destructive/20 border-none px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse shadow-sm">
                    <ShieldAlert className="w-4 h-4" />
                    Awaiting Auth
                  </Badge>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {user?.email === 'rxtools1@gmail.com' && (
            <Link 
              to="/admin" 
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                "hidden md:flex font-black text-[10px] h-10 rounded-xl px-5 hover:bg-primary/10 hover:text-primary no-underline uppercase tracking-widest"
              )}
            >
              Control Center
            </Link>
          )}

          {user ? (
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => signOut()} 
              className="font-black text-[10px] h-10 rounded-xl px-6 hover:bg-destructive/10 hover:text-destructive transition-all uppercase tracking-widest"
            >
              Terminate Session
            </Button>
          ) : (
            <div className="flex items-center gap-4">
              <Link 
                to="/admin/login"
                className="hidden lg:block text-[9px] font-black text-muted-foreground/40 hover:text-primary uppercase tracking-[0.3em] no-underline transition-all"
              >
                Restricted
              </Link>
              <Link 
                to="/login"
                className={cn(
                  buttonVariants({ variant: 'default' }),
                  "h-11 px-8 font-black text-xs rounded-xl no-underline shadow-xl shadow-primary/10 hover:shadow-primary/20 hover:-translate-y-0.5 transition-all uppercase tracking-widest"
                )}
              >
                LOGIN
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
