import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, buttonVariants } from '@/components/ui/button';
import { Hammer, LogIn, LogOut, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './ThemeToggle';

export default function Navbar() {
  const { user, isVerified, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="border-b bg-card sticky top-0 z-50 backdrop-blur-md bg-card/80">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-2xl tracking-tighter hover:scale-105 transition-transform">
          <Hammer className="w-7 h-7 text-primary" />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 uppercase">RX ELITE</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />
          
          <Link 
            to="/" 
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              "hidden md:flex font-bold uppercase italic tracking-wider no-underline"
            )}
          >
            Repository
          </Link>

          {user && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="hidden md:flex items-center gap-2"
              >
                {isVerified ? (
                  <Badge variant="outline" className="gap-1 border-primary/50 text-primary uppercase italic font-black">
                    <ShieldCheck className="w-3 h-3" />
                    Verified Elite
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1 uppercase italic font-black animate-pulse">
                    <ShieldAlert className="w-3 h-3" />
                    Unverified
                  </Badge>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {user?.email === 'rxtools1@gmail.com' && (
            <Link 
              to="/admin" 
              className={cn(
                buttonVariants({ variant: 'outline' }),
                "hidden md:flex font-bold uppercase italic tracking-wider border-primary/50 text-primary no-underline"
              )}
            >
              Dashboard
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => signOut()} className="text-muted-foreground hover:text-destructive">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link 
                to="/admin/login"
                className={cn(
                  buttonVariants({ variant: 'link' }),
                  "hidden lg:flex text-xs text-muted-foreground/50 hover:text-primary uppercase tracking-widest no-underline"
                )}
              >
                Admin
              </Link>
              <Link 
                to="/login"
                className={cn(
                  buttonVariants({ variant: 'default' }),
                  "gap-2 font-bold uppercase italic shadow-lg shadow-primary/20 no-underline"
                )}
              >
                <LogIn className="w-4 h-4" />
                Elite Access
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
