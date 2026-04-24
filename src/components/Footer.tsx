import { Link } from 'react-router-dom';
import { Hammer } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-32 pb-12 border-t border-border/50 bg-background/50 backdrop-blur-sm">
      <div className="container mx-auto px-6 pt-12 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-3 font-black text-xl tracking-tighter opacity-30 hover:opacity-100 transition-opacity duration-500 cursor-default">
          <div className="p-2 bg-muted rounded-xl ring-1 ring-border">
            <Hammer className="w-5 h-5" />
          </div>
          <span>RX ELITE</span>
        </div>
        
        <p className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground/30">
          © {new Date().getFullYear()} RX ELITE REPOSITORY. DEPLOYMENT_v3.4
        </p>

        <Link 
          to="/login" 
          className="group relative"
          aria-label="Admin Portal"
        >
          <div className="p-3 rounded-2xl bg-muted/30 ring-1 ring-border opacity-20 group-hover:opacity-100 group-hover:bg-primary/10 group-hover:ring-primary/20 transition-all duration-500">
            <Hammer className="w-5 h-5 text-foreground group-hover:text-primary transition-colors" />
          </div>
        </Link>
      </div>
    </footer>
  );
}
