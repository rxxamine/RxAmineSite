import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { handleFirestoreError } from '../lib/errorHandlers';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Save, X, BellRing, Upload, FileDown, AlertCircle, CheckCircle2, Info, Image as ImageIcon, Loader2, Key, ShieldAlert, ArrowLeft } from 'lucide-react';
import Papa from 'papaparse';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Tool {
  id: string;
  name: string;
  description: string;
  downloadUrl: string;
  imageUrl: string;
  section: string;
}

interface Settings {
  discordWebhookUrl: string;
  siteName: string;
  siteDescription: string;
}

const ALLOWED_CATEGORIES = ['elite', 'fivem', 'spoofers', 'spofers', 'cheats', 'tweaks', 'grabbers'];

export default function Admin() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  
  // Environment Check: Restrict access to specific AI Studio URL
  const isAuthorizedEnv = React.useMemo(() => {
    if (typeof window === 'undefined') return true;
    const hostname = window.location.hostname;
    // Allow localhost and specific preview subdomain (if applicable)
    if (hostname === 'localhost' || hostname.includes('ais-dev-')) return true;
    
    const referrer = document.referrer;
    const isInIframe = window.self !== window.top;
    const isFromStudio = referrer.includes('aistudio.google.com') || 
                         referrer.includes('eb17f459-0eaa-448a-8fd4-5ada9b308ba7');
    
    return isInIframe || isFromStudio;
  }, []);

  const [tools, setTools] = useState<Tool[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [settings, setSettings] = useState<Settings>({ discordWebhookUrl: '', siteName: '', siteDescription: '' });
  
  // Auto-detect sections from existing tools e.g. from bulk uploads or legacy data
  const autoSections = Array.from(new Set(tools.map(t => t.section)))
    .filter((s): s is string => typeof s === 'string' && ALLOWED_CATEGORIES.includes(s.toLowerCase()));
    
  const allAvailableSections = Array.from(new Set([...categories, ...autoSections]))
    .filter((s): s is string => typeof s === 'string' && ALLOWED_CATEGORIES.includes(s.toLowerCase()))
    .sort();
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [newTool, setNewTool] = useState<Partial<Tool>>({ name: '', description: '', downloadUrl: '', imageUrl: '', section: 'fivem' });
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [bulkUploadData, setBulkUploadData] = useState<any[]>([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkUploadErrors, setBulkUploadErrors] = useState<{ row: number; name: string; error: string }[]>([]);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [deleteCount, setDeleteCount] = useState(1);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [showConfirmRecent, setShowConfirmRecent] = useState(false);
  const [showConfirmCheats, setShowConfirmCheats] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/');
    }
  }, [loading, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;

    // Auto-provision default tools if missing
    const provisionDefaults = async (force = false) => {
      if (!isAdmin || loading) return;
      
      // If not forcing, check if we already have tools to avoid double-provisioning
      if (!force && tools.length > 0) return;

      const toastId = toast.loading("Restoring default repository data...");

      const defaultTools = [
        {
          name: "Wurst-Imperium",
          description: "Advanced Minecraft Cheat Client with built-in features for competitive play.",
          downloadUrl: "https://shrinkme.click/G04T2gY",
          imageUrl: "https://camo.githubusercontent.com/9a6016b447758207f4f626b34211ed437ea941f37d131ebbd7ff0556bc079a15/68747470733a2f2f692e696d6775722e636f6d2f446868714c58392e706e67",
          section: "cheats",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          name: "YimMenu",
          description: "A popular and feature-rich mod menu for Grand Theft Auto V.",
          downloadUrl: "https://shrinkme.click/ym2DVo",
          imageUrl: "https://yimmenu.org/wp-content/uploads/2024/05/YimMenu-vs.-Alacritty2.jpg",
          section: "cheats",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          name: "BT-FiveM-Extranel-v2",
          description: "External toolset for FiveM performance and utility enhancement.",
          downloadUrl: "https://shrinkme.click/Qh5FSL",
          imageUrl: "https://i.ibb.co/8D8vXyz/fivem.jpg",
          section: "fivem",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          name: "zensware-v1.2",
          description: "Premium external tool for competitive FPS games. (WinRAR PW: RxWare)",
          downloadUrl: "https://shrinkme.click/3RoML4",
          imageUrl: "https://i.ibb.co/Fb2BJtKY/0-TVBOpl-SS9g-HD.jpg",
          section: "cheats",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          name: "Ghost Spoofer",
          description: "Advanced HWID Spoofer to bypass hardware bans on multiple games.",
          downloadUrl: "https://shrinkme.click/gGI3Xa",
          imageUrl: "https://i.ibb.co/6YZB6f2/spoofer.jpg",
          section: "spofers",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          name: "Blank-Grabber",
          description: "Utility for security auditing and educational testing.",
          downloadUrl: "https://shrinkme.click/xyZWhbj",
          imageUrl: "https://media.licdn.com/dms/image/v2/D5622AQEhPfvUc-zzyA/feedshare-shrink_2048_1536/B56ZTvTGAzHEAo-/0/1739181548483?e=2147483647&v=beta&t=O-exRUQSwFcP4UyD_c4ujqzAani8oPbmqMKblkJGXLg",
          section: "grabbers",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          name: "RxSpoofer 1",
          description: "High-level hardware identity modification tool for maximum safety.",
          downloadUrl: "https://shrinkme.click/kEYM694a",
          imageUrl: "https://t2conline.com/wp-content/uploads/2022/07/maxresdefault-2.jpg",
          section: "spoofers",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          name: "BuLLeT Lua Executor v3.0",
          description: "Reliable and fast LUA executor for FiveM server environments.",
          downloadUrl: "https://shrinkme.click/5d2Wh",
          imageUrl: "https://i.ibb.co/JFq6DKmf/2-E8-Dz-dy-Gsw-HD.jpg",
          section: "fivem",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      for (const tool of defaultTools) {
        try {
          await addDoc(collection(db, 'tools'), tool);
          console.log(`Provisioned ${tool.name}`);
        } catch (err) {
          console.error(`Error provisioning ${tool.name}:`, err);
        }
      }
      toast.success("Restored default site data", { id: toastId });
    };
    
    // Use a ref to track if we've already tried to auto-provision in this session
    // to avoid loops if Firebase is slow to update the local 'tools' state
    if (tools.length === 0 && !loading && isAdmin) {
      const hasAutoProvisioned = sessionStorage.getItem('rx_auto_provisioned');
      if (!hasAutoProvisioned) {
        provisionDefaults();
        sessionStorage.setItem('rx_auto_provisioned', 'true');
      }
    }

    // Auto-provision default categories/settings if missing
    const checkDefaults = async () => {
      try {
        const catDoc = await getDoc(doc(db, 'settings', 'categories'));
        if (!catDoc.exists()) {
          await setDoc(doc(db, 'settings', 'categories'), { list: ['fivem', 'spoofers', 'spofers', 'cheats', 'tweaks', 'grabbers'] });
          console.log("Provisioned default categories");
        }
        
        const configDoc = await getDoc(doc(db, 'settings', 'config'));
        if (!configDoc.exists()) {
          await setDoc(doc(db, 'settings', 'config'), {
            siteName: "RX ELITE",
            siteDescription: "Premium Game Enhancement Repository",
            discordWebhookUrl: ""
          });
          console.log("Provisioned default config");
        }
      } catch (err) {
        console.error("Default provisioning error:", err);
      }
    };
    checkDefaults();

    const q = query(collection(db, 'tools'), orderBy('createdAt', 'desc'));
    const unsubscribeTools = onSnapshot(q, (snapshot) => {
      setTools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tool)));
    });

    const unsubscribeCategories = onSnapshot(doc(db, 'settings', 'categories'), (doc) => {
      if (doc.exists()) {
        setCategories(doc.data().list || ['fivem', 'spoofers', 'cheats', 'tweaks']);
      } else {
        setCategories(['fivem', 'spoofers', 'cheats', 'tweaks']);
      }
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'config'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as Settings);
      }
    });

    return () => {
      unsubscribeTools();
      unsubscribeCategories();
      unsubscribeSettings();
    };
  }, [isAdmin]);

  const handleAddCategory = async () => {
    if (!newCategory) return;
    const cat = newCategory.toLowerCase().trim();
    if (!ALLOWED_CATEGORIES.includes(cat)) {
      toast.error(`Category "${cat}" is not authorized.`);
      return;
    }
    const updatedCategories = Array.from(new Set([...categories, cat]));
    try {
      await setDoc(doc(db, 'settings', 'categories'), { list: updatedCategories });
      setNewCategory('');
      toast.success("Category added");
    } catch (err) {
      handleFirestoreError(err, 'update', 'settings/categories');
    }
  };

  const handleDeleteCategory = async (catToDelete: string) => {
    const updatedCategories = categories.filter(c => c !== catToDelete);
    try {
      await setDoc(doc(db, 'settings', 'categories'), { list: updatedCategories });
      toast.success("Category removed");
    } catch (err) {
      handleFirestoreError(err, 'update', 'settings/categories');
    }
  };

  const uploadFile = async (file: File, path: string): Promise<string> => {
    const isImage = file.type.startsWith('image/');
    if (isImage) setIsImageUploading(true);
    else setIsFileUploading(true);
    
    try {
      const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      return url;
    } catch (error) {
      console.error(`Error uploading ${isImage ? 'image' : 'file'}:`, error instanceof Error ? error.message : error);
      toast.error(`Failed to upload ${isImage ? 'image' : 'file'}`);
      throw error;
    } finally {
      if (isImage) setIsImageUploading(false);
      else setIsFileUploading(false);
    }
  };

  const handleAddTool = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsUploading(true);
    const toastId = toast.loading("Validating and adding tool...");

    try {
      // Direct Firestore creation using client SDK (bypassing failing backend API)
      const toolData = {
        ...newTool,
        section: newTool.section.toLowerCase(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'tools'), toolData);

      toast.success("Tool added successfully", { id: toastId });
      
      // Notify Discord via safe backend route
      if (settings.discordWebhookUrl) {
        try {
          await fetch('/api/notify-discord', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              webhookUrl: settings.discordWebhookUrl,
              toolName: toolData.name,
              toolDescription: toolData.description,
              toolUrl: toolData.downloadUrl,
              imageUrl: toolData.imageUrl
            })
          });
        } catch (err) {
          console.error("Discord notify error:", err instanceof Error ? err.message : err);
        }
      }

      setNewTool({ name: '', description: '', downloadUrl: '', imageUrl: '', section: 'fivem' });
    } catch (error: any) {
      console.error("Tool creation error:", error);
      toast.error(error.message || "Failed to create tool", { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const processCSV = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error("Please upload a CSV file");
      return;
    }

    const toastId = toast.loading("Reading CSV file...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        toast.dismiss(toastId);
        const data = results.data as any[];
        if (data.length === 0) {
          toast.error("The CSV file is empty");
          return;
        }
        setBulkUploadData(data);
        setShowBulkConfirm(true);
      },
      error: (error) => {
        toast.dismiss(toastId);
        toast.error("Error parsing CSV file");
        console.error(error instanceof Error ? error.message : error);
      }
    });
  };

  const handleBulkUpload = async () => {
    setShowBulkConfirm(false);
    setBulkUploadErrors([]);
    setIsUploading(true);
    const toastId = toast.loading(`Uploading ${bulkUploadData.length} tools... 0%`);

    let successCount = 0;
    const errors: { row: number; name: string; error: string }[] = [];

    for (let i = 0; i < bulkUploadData.length; i++) {
      const item = bulkUploadData[i];
      const rowIndex = i + 1;
      const toolName = item.name || `Row ${rowIndex}`;

      if (!item.name || !item.downloadUrl) {
        errors.push({
          row: rowIndex,
          name: toolName,
          error: !item.name ? "Missing name" : "Missing download URL"
        });
        continue;
      }

      try {
        const toolData = {
          name: item.name,
          description: item.description || '',
          downloadUrl: item.downloadUrl,
          imageUrl: item.imageUrl || '',
          section: (item.section || item.category || 'fivem').toLowerCase().trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await addDoc(collection(db, 'tools'), toolData);

        successCount++;
        
        const progress = Math.round(((i + 1) / bulkUploadData.length) * 100);
        toast.loading(`Uploading ${bulkUploadData.length} tools... ${progress}%`, { id: toastId });
      } catch (err: any) {
        console.error("Error adding tool in bulk:", err.message || err);
        errors.push({
          row: rowIndex,
          name: toolName,
          error: err.message || "Unknown error"
        });
      }
    }

    toast.dismiss(toastId);
    setBulkUploadErrors(errors);

    if (successCount > 0) {
      toast.success(`Successfully uploaded ${successCount} tools.`);
      
      if (settings.discordWebhookUrl) {
        try {
          await fetch('/api/notify-discord', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              webhookUrl: settings.discordWebhookUrl,
              toolName: `📦 Bulk Upload: ${successCount} New Tools`,
              toolDescription: `A batch of ${successCount} new tools has been added to the RX ELITE repository.`,
              toolUrl: window.location.origin,
              imageUrl: ''
            })
          });
        } catch (err) {
          console.error("Discord notify error:", err instanceof Error ? err.message : err);
        }
      }
    }
    
    if (errors.length > 0) {
      toast.error(`${errors.length} tools failed to upload. Check the error list below.`);
    }

    setIsUploading(false);
    setBulkUploadData([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processCSV(file);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processCSV(file);
  };

  const downloadTemplate = () => {
    const csvContent = "name,description,downloadUrl,imageUrl,section\nSample Tool,A great tool description,https://example.com/download,https://example.com/image.jpg,fivem";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "rx_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteTool = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tools', id));
      toast.success("Tool deleted");
    } catch (error) {
      toast.error("Error deleting tool");
      handleFirestoreError(error, 'delete', `tools/${id}`);
    }
  };

  const handleBulkDelete = async () => {
    if (deleteCount <= 0) return;
    const targets = tools.slice(0, deleteCount);
    if (targets.length === 0) {
      toast.error("No tools found to delete.");
      return;
    }

    setIsDeletingBulk(true);
    setShowConfirmRecent(false);
    const toastId = toast.loading(`Deleting ${targets.length} tools...`);
    let deleted = 0;

    for (const tool of targets) {
      try {
        await deleteDoc(doc(db, 'tools', tool.id));
        deleted++;
        toast.loading(`Deleting... (${deleted}/${targets.length})`, { id: toastId });
      } catch (err) {
        console.error("Bulk delete error:", err);
      }
    }

    setIsDeletingBulk(false);
    toast.dismiss(toastId);
    toast.success(`Successfully deleted ${deleted} tools.`);
  };

  const handleBulkDeleteCheats = async () => {
    const targets = tools.filter(t => t.section === 'cheats').slice(0, deleteCount);
    if (targets.length === 0) {
      toast.error("No tools found in 'cheats' section to delete.");
      return;
    }

    setIsDeletingBulk(true);
    setShowConfirmCheats(false);
    const toastId = toast.loading(`Deleting ${targets.length} cheats...`);
    let deleted = 0;

    for (const tool of targets) {
      try {
        await deleteDoc(doc(db, 'tools', tool.id));
        deleted++;
        toast.loading(`Deleting... (${deleted}/${targets.length})`, { id: toastId });
      } catch (err) {
        console.error("Bulk delete cheats error:", err);
      }
    }

    setIsDeletingBulk(false);
    toast.dismiss(toastId);
    toast.success(`Successfully deleted ${deleted} cheats.`);
  };

  const handleScrapeFling = async () => {
    setIsScraping(true);
    const toastId = toast.loading("Attempting to bypass security and grab trainers...");
    
    try {
      const res = await fetch('/api/scrape-fling');
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to scrape");
      
      if (data.trainers && data.trainers.length > 0) {
        toast.success(`Intercepted ${data.trainers.length} latest elite trainers!`, { id: toastId });
        setBulkUploadData(data.trainers);
        setShowBulkConfirm(true);
      } else {
        toast.error("No fresh trainers detected at the source.", { id: toastId });
      }
    } catch (err: any) {
      console.error("Scrape error:", err);
      toast.error(`Infiltration failed: ${err.message}`, { id: toastId });
    } finally {
      setIsScraping(false);
    }
  };

  const handleUpdateTool = async (id: string, toolData: Partial<Tool>) => {
    try {
      // Destructure to remove 'id' from the data sent to Firestore
      // as it causes validation failures in strict security rules (size check)
      const { id: _, ...cleanData } = toolData as any;
      
      await updateDoc(doc(db, 'tools', id), {
        ...cleanData,
        updatedAt: new Date().toISOString()
      });
      toast.success("Tool updated");
      setIsEditing(null);
    } catch (error) {
      toast.error("Error updating tool");
      handleFirestoreError(error, 'update', `tools/${id}`);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'config'), settings);
      toast.success("Settings saved");
    } catch (error) {
      toast.error("Error saving settings");
      handleFirestoreError(error, 'update', 'settings/config');
    }
  };

  if (loading) return <div className="text-center py-20 animate-pulse font-mono uppercase tracking-widest">Initialising Secure Subsystem...</div>;
  if (!isAdmin) return null;

  if (!isAuthorizedEnv) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="relative">
          <div className="absolute inset-0 bg-destructive/10 blur-3xl rounded-full scale-150 animate-pulse"></div>
          <div className="relative p-8 rounded-3xl bg-background/50 border-2 border-destructive/20 shadow-2xl backdrop-blur-xl">
            <ShieldAlert className="w-16 h-16 text-destructive" />
          </div>
        </div>
        
        <div className="space-y-4 max-w-sm text-center">
          <h1 className="text-3xl font-bold font-mono tracking-tighter uppercase text-foreground">Secure Access Restricted</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Administrative privileges are strictly limited to the authorized workspace environment. 
            Direct access to this dashboard is currently disabled for security.
          </p>
        </div>

        <div className="flex flex-col w-full max-w-xs gap-3">
          <Button 
            onClick={() => window.location.href = 'https://aistudio.google.com/apps/eb17f459-0eaa-448a-8fd4-5ada9b308ba7?showPreview=true&showAssistant=true'} 
            className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
          >
            Open in AI Studio
          </Button>
          <Button 
            onClick={() => navigate('/')} 
            variant="ghost" 
            className="w-full gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Application
          </Button>
        </div>
        
        <div className="pt-12 text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground/50">
          Security Protocol Enabled
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-8">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none mb-1">RX ELITE <span className="text-primary tracking-normal not-italic font-mono text-2xl">V4.0</span></h1>
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest opacity-80 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            System Control & Repository Management
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase border p-2 rounded bg-muted/30">
          <span className="opacity-50">Local Host:</span> 127.0.0.1
          <span className="mx-2 opacity-20">|</span>
          <span className="opacity-50">Auth Status:</span> Root Admin
        </div>
      </div>

      <Tabs defaultValue="tools" className="w-full">
        <div className="flex justify-center mb-8">
          <TabsList className="flex w-auto p-1 bg-muted/50 border rounded-full h-12 shadow-sm">
            <TabsTrigger value="tools" className="rounded-full px-6 transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono text-[10px] uppercase tracking-widest font-bold">Tools</TabsTrigger>
            <TabsTrigger value="categories" className="rounded-full px-6 transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono text-[10px] uppercase tracking-widest font-bold">Categories</TabsTrigger>
            <TabsTrigger value="bulk" className="rounded-full px-6 transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono text-[10px] uppercase tracking-widest font-bold">Bulk Upload</TabsTrigger>
            <TabsTrigger value="settings" className="rounded-full px-6 transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono text-[10px] uppercase tracking-widest font-bold">Settings</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tools" className="space-y-6">
          <div className="flex justify-between items-center gap-4">
            <h2 className="text-xl font-bold uppercase italic tracking-tight">Repository Items</h2>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 text-[10px] uppercase font-bold tracking-widest h-8"
              onClick={() => provisionDefaults(true)}
            >
              <FileDown className="w-3 h-3" />
              Reset to Defaults
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Add New Tool</CardTitle>
              <CardDescription>Fill in the details to add a new tool to the repository.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddTool} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tool Name</Label>
                  <Input 
                    id="name" 
                    value={newTool.name} 
                    onChange={e => setNewTool({...newTool, name: e.target.value})} 
                    placeholder="e.g. RX ELITE Spoofer"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="section">Section</Label>
                  <Select 
                    value={newTool.section} 
                    onValueChange={value => setNewTool({...newTool, section: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {allAvailableSections.map(section => (
                        <SelectItem key={section} value={section} className="capitalize">
                          {section}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="description">Description</Label>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-[10px] gap-1 uppercase italic font-bold text-primary"
                      onClick={() => setNewTool({...newTool, description: newTool.description + (newTool.description ? ' ' : '') + '(WinRAR PW: RxWare)'})}
                    >
                      <Key className="w-3 h-3" />
                      Add PW Reminder
                    </Button>
                  </div>
                  <Textarea 
                    id="description" 
                    value={newTool.description} 
                    onChange={e => setNewTool({...newTool, description: e.target.value})} 
                    placeholder="Describe what the tool does..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="downloadUrl">Download URL / File</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="downloadUrl" 
                      value={newTool.downloadUrl} 
                      onChange={e => setNewTool({...newTool, downloadUrl: e.target.value})} 
                      placeholder="https://example.com/download"
                      className="flex-1"
                    />
                    <div className="relative">
                      <Input
                        type="file"
                        className="hidden"
                        id="file-upload"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const url = await uploadFile(file, 'files');
                              setNewTool({ ...newTool, downloadUrl: url });
                              toast.success("File uploaded successfully");
                            } catch (err) {}
                          }
                          e.target.value = '';
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={isFileUploading}
                        onClick={() => document.getElementById('file-upload')?.click()}
                        title="Upload tool file"
                      >
                        {isFileUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imageUrl">Image URL / File (Optional)</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-2">
                      <Input 
                        id="imageUrl" 
                        value={newTool.imageUrl} 
                        onChange={e => setNewTool({...newTool, imageUrl: e.target.value})} 
                        placeholder="https://example.com/image.jpg"
                      />
                      {newTool.imageUrl && (
                        <div className="relative w-20 h-20 rounded border overflow-hidden bg-muted group">
                          <img 
                            src={newTool.imageUrl} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => (e.currentTarget.src = 'https://picsum.photos/seed/error/200/200')}
                          />
                          <button 
                            type="button"
                            onClick={() => setNewTool({...newTool, imageUrl: ''})}
                            className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="image-upload"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const url = await uploadFile(file, 'tools');
                              setNewTool({ ...newTool, imageUrl: url });
                              toast.success("Image uploaded successfully");
                            } catch (err) {}
                          }
                          e.target.value = '';
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={isImageUploading}
                        onClick={() => document.getElementById('image-upload')?.click()}
                        title="Upload image file"
                      >
                        {isImageUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <Button type="submit" className="md:col-span-2 gap-2 font-bold uppercase italic">
                  <Plus className="w-4 h-4" />
                  Add Tool to RX ELITE
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-semibold uppercase italic tracking-tighter">Current Repository</h2>
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border border-border">
                <span className="text-[10px] font-bold uppercase italic opacity-50 px-1">Maintenance:</span>
                <div className="flex items-center gap-1 border rounded bg-background px-2">
                  <span className="text-[10px] font-bold opacity-60">Latest:</span>
                  <input 
                    type="number" 
                    value={deleteCount} 
                    onChange={e => setDeleteCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-12 bg-transparent border-none text-xs focus:ring-0 p-1"
                  />
                </div>
                <div className="flex items-center gap-1">
                  {showConfirmCheats ? (
                    <div className="flex gap-1 animate-in fade-in slide-in-from-right-2">
                      <Button variant="destructive" size="sm" onClick={handleBulkDeleteCheats} className="h-8 text-[10px] font-black uppercase italic">Confirm</Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowConfirmCheats(false)} className="h-8 text-[10px] font-bold">No</Button>
                    </div>
                  ) : (
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="h-8 text-[10px] uppercase font-black italic gap-1"
                      onClick={() => setShowConfirmCheats(true)}
                      disabled={isDeletingBulk}
                    >
                      <Trash2 className="w-3 h-3" />
                      Del CSV Cheats
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {showConfirmRecent ? (
                    <div className="flex gap-1 animate-in fade-in slide-in-from-right-2">
                      <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="h-8 text-[10px] font-black uppercase italic">Confirm</Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowConfirmRecent(false)} className="h-8 text-[10px] font-bold">No</Button>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 text-[10px] uppercase font-bold italic gap-1"
                      onClick={() => setShowConfirmRecent(true)}
                      disabled={isDeletingBulk}
                    >
                      <AlertCircle className="w-3 h-3" />
                      Del Recent
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
              <div className="grid grid-cols-[1fr_100px_120px_100px] gap-4 p-4 border-b bg-muted/50 font-serif italic text-[11px] uppercase tracking-wider opacity-60">
                <div>Resource / Identifier</div>
                <div>Category</div>
                <div>Added On</div>
                <div className="text-right">Operations</div>
              </div>
              
              <div className="divide-y">
                {tools.map(tool => (
                  <div key={tool.id} className="group hover:bg-muted/30 transition-colors">
                    {isEditing === tool.id ? (
                      <div className="p-6 bg-muted/10 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold tracking-widest opacity-50">Tool Identity</Label>
                            <Input value={tool.name} onChange={e => setTools(tools.map(t => t.id === tool.id ? {...t, name: e.target.value} : t))} className="h-10 font-bold" />
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold tracking-widest opacity-50">Classification</Label>
                            <Select 
                              value={tool.section} 
                              onValueChange={value => setTools(tools.map(t => t.id === tool.id ? {...t, section: value} : t))}
                            >
                              <SelectTrigger className="h-10">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {allAvailableSections.map(section => (
                                  <SelectItem key={section} value={section} className="capitalize">
                                    {section}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-[10px] uppercase font-bold tracking-widest opacity-50">Functional Brief</Label>
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                className="h-5 text-[9px] gap-1 uppercase italic font-black text-primary hover:bg-primary/10"
                                onClick={() => setTools(tools.map(t => t.id === tool.id ? {...t, description: t.description + (t.description ? ' ' : '') + '(WinRAR PW: RxWare)'} : t))}
                              >
                                <Key className="w-3 h-3" />
                                Injection PW
                              </Button>
                            </div>
                            <Textarea 
                              value={tool.description} 
                              onChange={e => setTools(tools.map(t => t.id === tool.id ? {...t, description: e.target.value} : t))} 
                              className="min-h-[120px] text-sm leading-relaxed"
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold tracking-widest opacity-50">Binary Source / Payload</Label>
                            <div className="flex gap-2">
                              <Input 
                                value={tool.downloadUrl} 
                                onChange={e => setTools(tools.map(t => t.id === tool.id ? {...t, downloadUrl: e.target.value} : t))} 
                                placeholder="https://..."
                                className="flex-1 h-10 font-mono text-xs"
                              />
                              <Input
                                type="file"
                                className="hidden"
                                id={`edit-file-upload-${tool.id}`}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    try {
                                      const url = await uploadFile(file, 'files');
                                      setTools(tools.map(t => t.id === tool.id ? {...t, downloadUrl: url} : t));
                                      toast.success("File synchronized");
                                    } catch (err) {}
                                  }
                                  e.target.value = '';
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 shrink-0"
                                disabled={isFileUploading}
                                onClick={() => document.getElementById(`edit-file-upload-${tool.id}`)?.click()}
                              >
                                {isFileUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold tracking-widest opacity-50">Visual Asset</Label>
                            <div className="flex gap-2">
                              <div className="flex-1 space-y-2">
                                <Input 
                                  value={tool.imageUrl} 
                                  onChange={e => setTools(tools.map(t => t.id === tool.id ? {...t, imageUrl: e.target.value} : t))} 
                                  placeholder="https://..."
                                  className="h-10 font-mono text-xs"
                                />
                                {tool.imageUrl && (
                                  <div className="relative w-24 h-16 rounded border overflow-hidden bg-muted group/img cursor-pointer">
                                    <img 
                                      src={tool.imageUrl} 
                                      alt="Preview" 
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                    <button 
                                      type="button"
                                      onClick={() => setTools(tools.map(t => t.id === tool.id ? {...t, imageUrl: ''} : t))}
                                      className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center font-bold text-[10px] uppercase"
                                    >
                                      Detach Image
                                    </button>
                                  </div>
                                )}
                              </div>
                              <Input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                id={`edit-image-upload-${tool.id}`}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    try {
                                      const url = await uploadFile(file, 'tools');
                                      setTools(tools.map(t => t.id === tool.id ? {...t, imageUrl: url} : t));
                                      toast.success("Image synchronized");
                                    } catch (err) {}
                                  }
                                  e.target.value = '';
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 shrink-0"
                                disabled={isImageUploading}
                                onClick={() => document.getElementById(`edit-image-upload-${tool.id}`)?.click()}
                              >
                                {isImageUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <Button onClick={() => handleUpdateTool(tool.id, tool)} className="flex-1 gap-2 font-bold uppercase tracking-tighter italic">
                              <Save className="w-4 h-4" /> Finalize Update
                            </Button>
                            <Button variant="outline" onClick={() => setIsEditing(null)} className="px-6 gap-2 font-bold uppercase tracking-tighter italic">
                              <X className="w-4 h-4" /> Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-[1fr_100px_120px_100px] gap-4 p-4 items-center h-16">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded border bg-muted/50 overflow-hidden shrink-0">
                            {tool.imageUrl ? (
                              <img src={tool.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                                <ImageIcon className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm truncate">{tool.name}</h3>
                            <p className="text-[10px] font-mono opacity-50 truncate uppercase tracking-tighter">ID: {tool.id.substring(0, 8)}...</p>
                          </div>
                        </div>
                        
                        <div>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-tighter py-0 px-2 font-normal rounded-sm">
                            {tool.section}
                          </Badge>
                        </div>

                        <div className="text-[10px] font-mono opacity-40 uppercase tracking-tighter">
                          {tool.createdAt ? new Date(tool.createdAt).toLocaleDateString() : 'N/A'}
                        </div>

                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(tool.id)}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger
                              render={
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              }
                            />
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="font-serif italic">Confirm Purge?</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm">
                                  You are about to permanently delete <span className="text-foreground font-bold">"{tool.name}"</span> from the elite cluster.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="font-bold uppercase tracking-tighter italic">Abort</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteTool(tool.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold uppercase tracking-tighter italic"
                                >
                                  Execute
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <Card className="border-primary/10 overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="font-serif italic text-xl">Operational Classification</CardTitle>
              <CardDescription className="font-mono text-[10px] uppercase tracking-widest opacity-60">Manage repository filters and taxonomy</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              <div className="flex gap-4 p-4 border rounded-xl bg-card shadow-inner">
                <div className="flex-1 space-y-1">
                  <Label className="text-[10px] uppercase font-bold tracking-widest opacity-50 ml-1">New Descriptor</Label>
                  <Input 
                    value={newCategory} 
                    onChange={e => setNewCategory(e.target.value)} 
                    placeholder="Enter unique category ID..."
                    className="h-12 border-none bg-transparent text-lg font-black uppercase italic tracking-tighter focus-visible:ring-0"
                    onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                  />
                </div>
                <Button onClick={handleAddCategory} className="h-12 px-8 font-black uppercase italic tracking-tight gap-2">
                  <Plus className="w-5 h-5" /> Append Category
                </Button>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-serif italic opacity-60 flex items-center gap-2">
                  <div className="h-px bg-border flex-1" />
                  Existing Manifest
                  <div className="h-px bg-border flex-1" />
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {categories.map(cat => (
                    <div key={cat} className="flex items-center justify-between p-4 bg-muted/40 rounded-lg border-2 border-transparent hover:border-primary/20 hover:bg-muted transition-all group relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-primary/20" />
                      <span className="font-serif italic text-sm tracking-tight">{cat}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                        onClick={() => handleDeleteCategory(cat)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  {categories.length === 0 && <p className="col-span-full text-xs italic text-muted-foreground py-4 opacity-50 px-1">Global taxonomy is empty.</p>}
                </div>
              </div>

              <div className="space-y-4 pt-6">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-serif italic opacity-60">Detected Metadata (Unsaved)</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {autoSections.filter(s => !categories.includes(s)).map(cat => (
                    <div key={cat} className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border border-dashed hover:border-primary/20 transition-all group">
                      <span className="font-serif italic text-sm opacity-50">{cat}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-primary opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10"
                        onClick={() => {
                          setNewCategory(cat);
                          handleAddCategory();
                        }}
                        title="Add to Manifest"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  {autoSections.filter(s => !categories.includes(s)).length === 0 && (
                    <p className="col-span-full text-xs italic text-muted-foreground py-4 opacity-50 px-1">Global taxonomy is fully synced.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="border-primary/40 bg-primary/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <CheckCircle2 className="w-32 h-32 rotate-12" />
              </div>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-primary flex items-center gap-2 font-serif italic text-xl">
                       Automated Extraction
                    </CardTitle>
                    <CardDescription className="font-mono text-[10px] uppercase tracking-wider">Sync with Elite Master Repositories</CardDescription>
                  </div>
                  <Badge variant="default" className="animate-pulse bg-primary text-[10px] font-mono border-none h-5 px-1">ELITE_LINK</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-background/50 border p-3 rounded font-mono text-[10px] leading-tight opacity-70">
                  // INFILTRATION ACTIVE<br/>
                  // TARGET: flingtrainer.com<br/>
                  // BYPASS: Image-Validation Protocol Enabled
                </div>
                <Button 
                  onClick={handleScrapeFling} 
                  disabled={isScraping}
                  className="w-full h-16 text-xl font-black uppercase italic tracking-tighter shadow-xl shadow-primary/20 group hover:scale-[1.01] transition-transform"
                >
                  {isScraping ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-6 h-6 mr-2 group-hover:rotate-90 transition-transform" />
                      Grab Master List
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bulk Upload Tools</CardTitle>
                <CardDescription>Upload multiple tools at once using a CSV file.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium">CSV Format Requirements:</p>
                  <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                    <li>Headers must include: <code className="bg-background px-1 rounded">name</code>, <code className="bg-background px-1 rounded">downloadUrl</code></li>
                    <li>Optional headers: <code className="bg-background px-1 rounded">description</code>, <code className="bg-background px-1 rounded">imageUrl</code>, <code className="bg-background px-1 rounded">section</code></li>
                  </ul>
                  <Button variant="outline" size="sm" onClick={downloadTemplate} className="mt-2 gap-2">
                    <FileDown className="w-4 h-4" />
                    Download Template CSV
                  </Button>
                </div>

                <div className="space-y-4">
                  <Label 
                    htmlFor="csv-upload" 
                    className={`block p-8 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all duration-200 ${
                      isDragging 
                        ? "border-primary bg-primary/5 scale-[1.02]" 
                        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted"
                    } ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <Upload className={`w-10 h-10 mx-auto mb-4 transition-transform duration-200 ${isDragging ? "scale-110 text-primary" : "text-muted-foreground"}`} />
                    <div className="space-y-1">
                      <p className="text-base font-semibold">
                        {isDragging ? "Drop your CSV here" : "Click or drag CSV to upload"}
                      </p>
                    </div>
                    <Input 
                      id="csv-upload" 
                      type="file" 
                      accept=".csv" 
                      className="hidden" 
                      onChange={handleFileSelect}
                      disabled={isUploading}
                    />
                  </Label>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-6">
            {bulkUploadErrors.length > 0 && (
              <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-destructive font-semibold">
                    <AlertCircle className="w-5 h-5" />
                    <h2>Upload Errors ({bulkUploadErrors.length})</h2>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setBulkUploadErrors([])}
                    className="text-muted-foreground hover:text-foreground h-8"
                  >
                    Clear Errors
                  </Button>
                </div>
                <div className="max-h-60 overflow-y-auto border rounded-lg divide-y bg-muted/30">
                  {bulkUploadErrors.map((err, idx) => (
                    <div key={idx} className="p-3 text-sm flex items-start gap-3 hover:bg-muted/50 transition-colors">
                      <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded font-mono text-xs mt-0.5 shrink-0">
                        Row {err.row}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{err.name}</p>
                        <p className="text-muted-foreground text-xs break-words">{err.error}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <AlertDialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Bulk Upload</AlertDialogTitle>
                  <AlertDialogDescription>
                    You are about to upload <span className="font-bold text-foreground">{bulkUploadData.length}</span> tools to the repository. 
                    Are you sure you want to proceed?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setBulkUploadData([])}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleBulkUpload}>
                    Start Upload
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {isUploading && (
              <div className="mt-4 space-y-2 text-center">
                <p className="text-sm font-medium animate-pulse">Processing your tools...</p>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className="bg-primary h-full animate-progress-indeterminate"></div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Site Settings</CardTitle>
              <CardDescription>Configure global site parameters and integrations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="webhook" className="flex items-center gap-2">
                  <BellRing className="w-4 h-4" />
                  Discord Webhook URL
                </Label>
                <Input 
                  id="webhook" 
                  value={settings.discordWebhookUrl} 
                  onChange={e => setSettings({...settings, discordWebhookUrl: e.target.value})} 
                  placeholder="https://discord.com/api/webhooks/..."
                />
                <p className="text-xs text-muted-foreground">
                  New tools will be automatically announced to this Discord channel.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="siteName">Site Name</Label>
                <Input 
                  id="siteName" 
                  value={settings.siteName} 
                  onChange={e => setSettings({...settings, siteName: e.target.value})} 
                  placeholder="RX ELITE"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="siteDesc">Site Description</Label>
                <Textarea 
                  id="siteDesc" 
                  value={settings.siteDescription} 
                  onChange={e => setSettings({...settings, siteDescription: e.target.value})} 
                  placeholder="Premium tool repository..."
                />
              </div>

              <Button onClick={handleSaveSettings} className="w-full gap-2">
                <Save className="w-4 h-4" />
                Save All Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

