import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, buttonVariants } from '@/components/ui/button';
import { Download, ExternalLink, Search, Sparkles, Lock, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Tool {
  id: string;
  name: string;
  description: string;
  downloadUrl: string;
  imageUrl: string;
  section: string;
}

const ALLOWED_CATEGORIES = ['elite', 'fivem', 'spofers', 'cheats', 'tweaks', 'grabbers', 'tools'];

export default function Home() {
  const { user, isVerified } = useAuth();
  const [tools, setTools] = useState<Tool[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [settings, setSettings] = useState({ siteName: 'RX ELITE', siteDescription: 'Premium Game Enhancement Repository' });
  const [search, setSearch] = useState('');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'tools'), orderBy('createdAt', 'desc'));
    const unsubscribeTools = onSnapshot(q, (snapshot) => {
      const toolsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tool));
      setTools(toolsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching tools:", error.message || error);
      setLoading(false);
    });

    const unsubscribeCategories = onSnapshot(doc(db, 'settings', 'categories'), (doc) => {
      if (doc.exists()) {
        setCategories(doc.data().list || []);
      }
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'config'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setSettings({
          siteName: data.siteName || 'RX ELITE',
          siteDescription: data.siteDescription || 'Premium Game Enhancement Repository'
        });
      }
    });

    return () => {
      unsubscribeTools();
      unsubscribeCategories();
      unsubscribeSettings();
    };
  }, []);

  // Compute all available sections (manually defined + auto-detected from tools)
  const allSections = Array.from(new Set([
    ...categories,
    ...tools.map(t => t.section).filter(Boolean)
  ]))
    .filter((s): s is string => typeof s === 'string' && ALLOWED_CATEGORIES.includes(s.toLowerCase()))
    .sort((a, b) => {
      if (a.toLowerCase() === 'fivem') return -1;
      if (b.toLowerCase() === 'fivem') return 1;
      return a.localeCompare(b);
    });

  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(search.toLowerCase()) ||
      tool.description.toLowerCase().includes(search.toLowerCase());
    const matchesSection = !selectedSection || tool.section === selectedSection;
    return matchesSearch && matchesSection;
  }).sort((a, b) => {
    // Prioritize fivem section to be at the top
    const aIsFiveM = a.section.toLowerCase() === 'fivem';
    const bIsFiveM = b.section.toLowerCase() === 'fivem';
    if (aIsFiveM && !bIsFiveM) return -1;
    if (!aIsFiveM && bIsFiveM) return 1;
    return 0; // Secondary sort is by date (from Firestore state)
  });

  return (
    <div className="space-y-16 pb-20">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="text-center space-y-4 py-20 relative"
      >
        <div className="space-y-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Badge variant="outline" className="rounded-full px-6 py-1.5 border-primary/20 text-primary bg-primary/5 uppercase tracking-[0.2em] text-[10px] font-black shadow-sm">
              Premium Repository v3.4
            </Badge>
          </motion.div>
          
          <h1 className="text-6xl font-black tracking-tighter lg:text-8xl bg-clip-text text-transparent bg-gradient-to-b from-foreground via-foreground to-foreground/50 leading-[0.9]">
            {settings.siteName}
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-medium leading-relaxed opacity-60">
            {settings.siteDescription}
          </p>
          
          <div className="flex items-center justify-center gap-8 text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/40">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)] animate-pulse" />
              Mainnet Online
            </div>
            <div className="w-[1px] h-4 bg-border/50" />
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_15px_rgba(var(--primary),0.6)]" />
              Identity Encrypted
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/5 blur-[120px] rounded-full" />
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="flex flex-col gap-10 max-w-5xl mx-auto px-4"
      >
        <div className="relative group max-w-2xl mx-auto w-full">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/5 rounded-[2rem] blur-xl opacity-0 group-focus-within:opacity-100 transition duration-1000" />
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary w-5 h-5 transition-colors" />
            <Input 
              placeholder="Search secure database..." 
              className="pl-14 h-16 bg-background/50 backdrop-blur-xl border-none ring-1 ring-border/50 focus-visible:ring-primary/30 rounded-2xl shadow-xl text-lg font-medium transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          <Button 
            variant={selectedSection === null ? "default" : "secondary"}
            onClick={() => setSelectedSection(null)}
            className={cn(
              "h-11 px-8 rounded-full font-black uppercase tracking-wider text-[11px] transition-all duration-300",
              selectedSection === null 
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105" 
                : "bg-muted/50 hover:bg-muted text-muted-foreground border-none ring-1 ring-border/50"
            )}
          >
            Universal
          </Button>
          {allSections.map(section => (
            <Button 
              key={section}
              variant={selectedSection === section ? "default" : "secondary"}
              onClick={() => setSelectedSection(section)}
              className={cn(
                "h-11 px-8 rounded-full font-black uppercase tracking-wider text-[11px] transition-all duration-300 capitalize",
                selectedSection === section 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105" 
                  : "bg-muted/50 hover:bg-muted text-muted-foreground border-none ring-1 ring-border/50"
              )}
            >
              {section}
            </Button>
          ))}
        </div>
      </motion.div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-primary/10 border-t-primary animate-spin" />
            <div className="absolute inset-2 rounded-full border-4 border-primary/5 border-b-primary animate-spin-reverse" />
          </div>
          <motion.div 
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-[10px] font-black tracking-[0.4em] text-primary uppercase"
          >
            Decrypting Nodes...
          </motion.div>
        </div>
      ) : (
        <motion.div 
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: { staggerChildren: 0.1 }
            }
          }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 px-4"
        >
          {filteredTools.map((tool) => (
            <motion.div
              layout
              key={tool.id}
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 }
              }}
              className="h-full"
            >
              <Card className="overflow-hidden h-full flex flex-col border-none ring-1 ring-border/50 hover:ring-primary/20 transition-all duration-500 group bg-background shadow-sm hover:shadow-2xl hover:shadow-primary/5 rounded-[2rem] relative">
                {/* Image Section */}
                <div className="aspect-[16/10] w-full bg-muted/30 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20 z-10" />
                  
                  {tool.imageUrl ? (
                    <img 
                      src={tool.imageUrl} 
                      alt={tool.name} 
                      className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-1000 ease-out"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/20">
                      Asset Not Found
                    </div>
                  )}
                  
                  {/* Subtle Scanning Effect */}
                  <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                    <div className="w-full h-1/2 bg-gradient-to-b from-transparent via-primary/10 to-transparent -translate-y-full animate-scanning" />
                  </div>

                  <div className="absolute top-5 right-5 z-30">
                    <Badge className="capitalize font-black text-[9px] tracking-widest rounded-full shadow-2xl backdrop-blur-md bg-background/60 text-foreground border-none px-4 py-1.5" variant="outline">
                      {tool.section}
                    </Badge>
                  </div>
                </div>
                
                <CardHeader className="space-y-4 pt-8 pb-6 px-8 flex-grow">
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-2xl font-black tracking-tight group-hover:text-primary transition-colors duration-300">
                      {tool.name}
                    </CardTitle>
                    {tool.section?.toLowerCase() === 'fivem' && (
                      <div className="p-2 rounded-xl bg-primary/5 text-primary">
                        <Lock className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  
                  <CardDescription className="line-clamp-3 text-sm font-medium leading-relaxed text-muted-foreground/80">
                    {tool.description}
                  </CardDescription>

                  {tool.section?.toLowerCase() === 'fivem' && (
                    <div className="flex items-center gap-2.5 pt-2">
                       <div className="flex -space-x-2">
                          {[...Array(3)].map((_, i) => (
                             <div key={i} className="w-6 h-6 rounded-full border-2 border-background bg-muted overflow-hidden flex items-center justify-center">
                                <Key className="w-3 h-3 text-primary opacity-40" />
                             </div>
                          ))}
                       </div>
                       <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">
                          Auth Required
                       </span>
                    </div>
                  )}
                </CardHeader>

                <CardFooter className="pt-2 pb-8 px-8">
                  {isVerified ? (
                    <a 
                      href={tool.downloadUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={cn(
                        buttonVariants({ variant: 'default' }),
                        "w-full h-14 flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/10 hover:shadow-primary/20 hover:-translate-y-1 active:translate-y-0 transition-all duration-300 no-underline bg-primary hover:bg-primary/90"
                      )}
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  ) : (
                    <Link 
                      to="/login"
                      className={cn(
                        buttonVariants({ variant: 'secondary' }),
                        "w-full h-14 flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest rounded-2xl no-underline hover:bg-primary hover:text-white transition-all duration-300 border-none ring-1 ring-border/50"
                      )}
                    >
                      <Lock className="w-4 h-4" />
                      Login To Get Access
                    </Link>
                  )}
                </CardFooter>
              </Card>
            </motion.div>
          ))}
          {filteredTools.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full text-center py-24 bg-muted/10 rounded-[3rem] border border-dashed border-border/50"
            >
              <p className="text-sm font-black tracking-[0.5em] opacity-20 uppercase">Data Stream Empty</p>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
