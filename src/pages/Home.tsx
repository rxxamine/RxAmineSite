import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, buttonVariants } from '@/components/ui/button';
import { Download, ExternalLink, Search, Sparkles, Lock } from 'lucide-react';
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

const ALLOWED_CATEGORIES = ['elite', 'fivem', 'spoofers', 'cheats', 'tweaks', 'grabbers'];

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
    <div className="space-y-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center space-y-6 py-12"
      >
        <h1 className="text-5xl font-black tracking-tighter lg:text-7xl uppercase italic bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
          {settings.siteName}
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
          {settings.siteDescription}
        </p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="flex flex-col md:flex-row gap-4 max-w-4xl mx-auto"
      >
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input 
            placeholder="Search tools..." 
            className="pl-10 h-12"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          <Button 
            variant={selectedSection === null ? "default" : "outline"}
            onClick={() => setSelectedSection(null)}
            className="h-12 px-6 rounded-full capitalize"
          >
            All
          </Button>
          {allSections.map(section => (
            <Button 
              key={section}
              variant={selectedSection === section ? "default" : "outline"}
              onClick={() => setSelectedSection(section)}
              className="h-12 px-6 rounded-full capitalize"
            >
              {section}
            </Button>
          ))}
        </div>
      </motion.div>

      {loading ? (
        <div className="text-center py-20">
          <motion.div 
            animate={{ scale: [1, 1.05, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-xl font-bold tracking-widest text-primary/60"
          >
            LOADING RX ELITE REPOSITORY...
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
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {filteredTools.map((tool) => (
            <motion.div
              key={tool.id}
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 }
              }}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="overflow-hidden h-full flex flex-col border-2 hover:border-primary transition-all group bg-card/50 backdrop-blur-sm shadow-lg hover:shadow-primary/5">
                <div className="aspect-video w-full bg-muted relative overflow-hidden">
                  {tool.imageUrl ? (
                    <img 
                      src={tool.imageUrl} 
                      alt={tool.name} 
                      className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-700"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground font-bold italic opacity-20">
                      RX ELITE ASSET MISSING
                    </div>
                  )}
                  {tool.section && (
                    <Badge className="absolute top-3 right-3 uppercase font-black italic shadow-lg" variant="default">
                      {tool.section}
                    </Badge>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold tracking-tight group-hover:text-primary transition-colors">{tool.name}</CardTitle>
                  <CardDescription className="line-clamp-2 text-base">
                    {tool.description}
                  </CardDescription>
                  {tool.section?.toLowerCase() === 'fivem' && (
                    <div className="mt-4 pt-4 border-t border-primary/10 flex items-center gap-2 text-xs font-bold uppercase italic tracking-wider text-primary/70">
                      <Lock className="w-3 h-3" />
                      WinRAR PW: RxWare
                    </div>
                  )}
                </CardHeader>
                <CardFooter className="mt-auto pt-4 pb-6">
                  {isVerified ? (
                    <a 
                      href={tool.downloadUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={cn(
                        buttonVariants({ variant: 'default' }),
                        "w-full h-12 flex items-center justify-center gap-3 text-lg font-bold uppercase italic shadow-lg hover:shadow-primary/20 transition-all no-underline"
                      )}
                    >
                      <Sparkles className="w-5 h-5 animate-pulse text-yellow-500" />
                      Download Access
                    </a>
                  ) : (
                    <Link 
                      to="/login"
                      className={cn(
                        buttonVariants({ variant: 'secondary' }),
                        "w-full h-12 flex items-center justify-center gap-3 text-lg font-bold uppercase italic no-underline"
                      )}
                    >
                      <Lock className="w-5 h-5" />
                      Verify to Access
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
              className="col-span-full text-center py-20 text-muted-foreground border-2 border-dashed rounded-3xl"
            >
              <p className="text-xl font-bold italic uppercase">No tools found (Unauthorized Sector).</p>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
