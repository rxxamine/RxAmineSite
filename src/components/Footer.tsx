import { Link } from 'react-router-dom';
import { Hammer } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t bg-card mt-20">
      <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tighter opacity-50">
          <Hammer className="w-5 h-5" />
          <span>RX ELITE</span>
        </div>
        
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} RX ELITE. All rights reserved.
        </p>

        <Link 
          to="/login" 
          className="p-4 rounded-full hover:bg-muted transition-all opacity-20 hover:opacity-100 z-[9999] relative block cursor-pointer"
          aria-label="Admin Login"
        >
          <Hammer className="w-6 h-6 pointer-events-none" />
        </Link>
      </div>
    </footer>
  );
}
