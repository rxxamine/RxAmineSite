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
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { handleFirestoreError } from '../lib/errorHandlers';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Save, X, BellRing, Upload, FileDown, AlertCircle, CheckCircle2, Info, Image as ImageIcon, Loader2, Key, ShieldAlert, ArrowLeft } from 'lucide-react';
import Papa from 'papaparse';
import { Progress } from '@/components/ui/progress';
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

const ALLOWED_CATEGORIES = ['elite', 'fivem', 'spofers', 'cheats', 'tweaks', 'grabbers', 'tools'];

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
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [fileUploadProgress, setFileUploadProgress] = useState(0);
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

    const q = query(collection(db, 'tools'), orderBy('createdAt', 'desc'));
    const unsubscribeTools = onSnapshot(q, (snapshot) => {
      setTools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tool)));
    });

    const unsubscribeCategories = onSnapshot(doc(db, 'settings', 'categories'), (doc) => {
      if (doc.exists()) {
        setCategories(doc.data().list || []);
      } else {
        setCategories([]);
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
    const setProgress = isImage ? setImageUploadProgress : setFileUploadProgress;
    
    if (isImage) setIsImageUploading(true);
    else setIsFileUploading(true);
    
    setProgress(0);
    
    try {
      const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setProgress(progress);
          },
          (error) => {
            console.error(`Error uploading ${isImage ? 'image' : 'file'}:`, error instanceof Error ? error.message : error);
            toast.error(`Failed to upload ${isImage ? 'image' : 'file'}`);
            if (isImage) setIsImageUploading(false);
            else setIsFileUploading(false);
            reject(error);
          },
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            if (isImage) setIsImageUploading(false);
            else setIsFileUploading(false);
            setProgress(100);
            resolve(url);
          }
        );
      });
    } catch (error) {
      console.error(`Error initiating ${isImage ? 'image' : 'file'} upload:`, error instanceof Error ? error.message : error);
      if (isImage) setIsImageUploading(false);
      else setIsFileUploading(false);
      throw error;
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
      transformHeader: (header) => header.toLowerCase().trim(),
      complete: (results) => {
        toast.dismiss(toastId);
        const data = results.data as any[];
        if (data.length === 0) {
          toast.error("The CSV file is empty");
          return;
        }
        
        // Normalize column names
        const normalizedData = data.map(row => {
          const newRow: any = {};
          Object.keys(row).forEach(key => {
            const lowKey = key.toLowerCase();
            if (lowKey.includes('name') || lowKey === 'title') newRow.name = row[key];
            else if (lowKey.includes('desc')) newRow.description = row[key];
            else if (lowKey.includes('url') && !lowKey.includes('image')) newRow.downloadUrl = row[key];
            else if (lowKey.includes('image') || lowKey.includes('img') || lowKey.includes('pic')) newRow.imageUrl = row[key];
            else if (lowKey.includes('section') || lowKey.includes('cat')) newRow.section = row[key];
            else newRow[key] = row[key]; // Keep original as fallback
          });
          return newRow;
        });

        setBulkUploadData(normalizedData);
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
          <h1 className="text-4xl font-extrabold tracking-tight mb-1">System Control</h1>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
            Repository Nodes & Configuration
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="rounded-full font-bold h-10 px-6 shrink-0" onClick={() => navigate('/')}>
             View Site
          </Button>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-muted/50 px-4 h-10 rounded-full border">
            <span className="opacity-50">Auth Status:</span> Root Admin
          </div>
        </div>
      </div>

      <Tabs defaultValue="tools" className="w-full space-y-8">
        <div className="flex justify-center">
          <TabsList className="bg-muted/50 p-1 rounded-full h-12">
            <TabsTrigger value="tools" className="rounded-full px-8 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">Repository</TabsTrigger>
            <TabsTrigger value="categories" className="rounded-full px-8 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">Categories</TabsTrigger>
            <TabsTrigger value="bulk" className="rounded-full px-8 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">Bulk Handling</TabsTrigger>
            <TabsTrigger value="settings" className="rounded-full px-8 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">Settings</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tools" className="space-y-6">
          <div className="flex justify-between items-center gap-4">
            <h2 className="text-xl font-bold uppercase italic tracking-tight">Repository Items</h2>
          </div>

          <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 pb-6 border-b border-border/50">
              <CardTitle className="text-xl font-bold">Initialize New Node</CardTitle>
              <CardDescription className="font-medium">Fill in the architectural details to add a new tool to the repository.</CardDescription>
            </CardHeader>
            <CardContent className="pt-8">
              <form onSubmit={handleAddTool} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="font-bold text-xs uppercase tracking-wider opacity-60">Tool Designation</Label>
                  <Input 
                    id="name" 
                    value={newTool.name} 
                    onChange={e => setNewTool({...newTool, name: e.target.value})} 
                    placeholder="e.g. RX ELITE Spoofer"
                    className="rounded-xl h-11 bg-muted/20 border-none font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="section" className="font-bold text-xs uppercase tracking-wider opacity-60">Sector Assignment</Label>
                  <Select 
                    value={newTool.section} 
                    onValueChange={value => setNewTool({...newTool, section: value})}
                  >
                    <SelectTrigger className="rounded-xl h-11 bg-muted/20 border-none font-medium">
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {allAvailableSections.map(section => (
                        <SelectItem key={section} value={section} className="capitalize font-bold">
                          {section}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="description" className="font-bold text-xs uppercase tracking-wider opacity-60">Functional Description</Label>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 rounded-full text-[10px] gap-1.5 uppercase font-bold text-primary bg-primary/5 hover:bg-primary/10 px-3"
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
                    className="rounded-xl min-h-[120px] bg-muted/20 border-none font-medium resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="downloadUrl" className="font-bold text-xs uppercase tracking-wider opacity-60">Distribution Link</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="downloadUrl" 
                      value={newTool.downloadUrl} 
                      onChange={e => setNewTool({...newTool, downloadUrl: e.target.value})} 
                      placeholder="https://example.com/download"
                      className="rounded-xl h-11 bg-muted/20 border-none font-medium"
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
                              toast.success("Binary successfully uplinked!");
                            } catch (err) {}
                          }
                          e.target.value = '';
                        }}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="rounded-xl h-11 w-11 shadow-sm shrink-0"
                        disabled={isFileUploading}
                        onClick={() => document.getElementById('file-upload')?.click()}
                      >
                        {isFileUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  {isFileUploading && (
                    <div className="mt-2 space-y-1.5 px-1">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-50">
                        <span>Syncing binary...</span>
                        <span>{Math.round(fileUploadProgress)}%</span>
                      </div>
                      <Progress value={fileUploadProgress} className="h-1 rounded-full bg-muted shadow-inner" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imageUrl" className="font-bold text-xs uppercase tracking-wider opacity-60">Visual Asset Link</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-3">
                      <Input 
                        id="imageUrl" 
                        value={newTool.imageUrl} 
                        onChange={e => setNewTool({...newTool, imageUrl: e.target.value})} 
                        placeholder="https://example.com/image.jpg"
                        className="rounded-xl h-11 bg-muted/20 border-none font-medium"
                      />
                      {newTool.imageUrl && (
                        <div className="relative w-24 h-24 rounded-xl border-2 border-muted overflow-hidden bg-muted group shadow-inner">
                          <img 
                            src={newTool.imageUrl} 
                            alt="Preview" 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                            onError={(e) => (e.currentTarget.src = 'https://picsum.photos/seed/error/200/200')}
                          />
                          <button 
                            type="button"
                            onClick={() => setNewTool({...newTool, imageUrl: ''})}
                            className="absolute inset-0 bg-black/40 backdrop-blur-[1px] text-white opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                          >
                            <X className="w-5 h-5" />
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
                              toast.success("Asset successfully synced!");
                            } catch (err) {}
                          }
                          e.target.value = '';
                        }}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="rounded-xl h-11 w-11 shadow-sm shrink-0"
                        disabled={isImageUploading}
                        onClick={() => document.getElementById('image-upload')?.click()}
                      >
                        {isImageUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  {isImageUploading && (
                    <div className="mt-2 space-y-1.5 px-1">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-50">
                        <span>Syncing asset...</span>
                        <span>{Math.round(imageUploadProgress)}%</span>
                      </div>
                      <Progress value={imageUploadProgress} className="h-1 rounded-full bg-muted shadow-inner" />
                    </div>
                  )}
                </div>
                <Button type="submit" className="md:col-span-2 h-12 rounded-xl font-bold gap-2 shadow-lg shadow-primary/10 transition-all hover:-translate-y-0.5 active:translate-y-0">
                  <Plus className="w-5 h-5" />
                  Push to Production
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-bold tracking-tight">Current Repository</h2>
              <div className="flex items-center gap-3 p-1.5 bg-muted/50 rounded-full border border-border/50">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-50 px-3">Maintenance</span>
                <div className="flex items-center gap-2 bg-background/80 px-3 h-8 rounded-full border shadow-sm">
                  <span className="text-[10px] font-bold opacity-60">Count:</span>
                  <input 
                    type="number" 
                    value={deleteCount} 
                    onChange={e => setDeleteCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-10 bg-transparent border-none text-[10px] font-bold focus:ring-0 p-0"
                  />
                </div>
                <div className="flex items-center gap-1">
                  {showConfirmCheats ? (
                    <div className="flex gap-1 animate-in fade-in slide-in-from-right-3">
                      <Button variant="destructive" size="sm" onClick={handleBulkDeleteCheats} className="h-8 rounded-full text-[10px] font-bold px-4">Confirm</Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowConfirmCheats(false)} className="h-8 rounded-full text-[10px] font-bold px-4">No</Button>
                    </div>
                  ) : (
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="h-8 rounded-full text-[10px] font-bold px-4 gap-2"
                      onClick={() => setShowConfirmCheats(true)}
                      disabled={isDeletingBulk}
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear Sector
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {showConfirmRecent ? (
                    <div className="flex gap-1 animate-in fade-in slide-in-from-right-3">
                      <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="h-8 rounded-full text-[10px] font-bold px-4">Confirm</Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowConfirmRecent(false)} className="h-8 rounded-full text-[10px] font-bold px-4">No</Button>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 rounded-full text-[10px] font-bold px-4 gap-2 shadow-sm"
                      onClick={() => setShowConfirmRecent(true)}
                      disabled={isDeletingBulk}
                    >
                      <AlertCircle className="w-3 h-3" />
                      Bulk Purge
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-background rounded-2xl border-none ring-1 ring-border shadow-sm overflow-hidden">
              <div className="grid grid-cols-[1fr_120px_140px_120px] gap-4 p-4 border-b bg-muted/30 text-[10px] font-bold uppercase tracking-widest opacity-50">
                <div className="pl-2">Resource Node</div>
                <div>Classification</div>
                <div>Timestamp</div>
                <div className="text-right pr-2">Control</div>
              </div>
              
              <div className="divide-y divide-border/50">
                {tools.map(tool => (
                  <div key={tool.id} className="group hover:bg-muted/10 transition-colors">
                    {isEditing === tool.id ? (
                      <div className="p-8 bg-muted/5 grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in zoom-in-95 duration-200">
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold tracking-widest opacity-50">Tool Identity</Label>
                            <Input value={tool.name} onChange={e => setTools(tools.map(t => t.id === tool.id ? {...t, name: e.target.value} : t))} className="h-11 rounded-xl bg-background border-none ring-1 ring-border font-bold" />
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold tracking-widest opacity-50">Classification</Label>
                            <Select 
                              value={tool.section} 
                              onValueChange={value => setTools(tools.map(t => t.id === tool.id ? {...t, section: value} : t))}
                            >
                              <SelectTrigger className="h-11 rounded-xl bg-background border-none ring-1 ring-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {allAvailableSections.map(section => (
                                  <SelectItem key={section} value={section} className="capitalize font-bold">
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
                                className="h-7 rounded-full text-[9px] gap-1.5 uppercase font-bold text-primary bg-primary/5 hover:bg-primary/10 px-3"
                                onClick={() => setTools(tools.map(t => t.id === tool.id ? {...t, description: t.description + (t.description ? ' ' : '') + '(WinRAR PW: RxWare)'} : t))}
                              >
                                <Key className="w-3 h-3" />
                                Add PW
                              </Button>
                            </div>
                            <Textarea 
                              value={tool.description} 
                              onChange={e => setTools(tools.map(t => t.id === tool.id ? {...t, description: e.target.value} : t))} 
                              className="min-h-[140px] rounded-xl bg-background border-none ring-1 ring-border text-sm leading-relaxed font-medium resize-none"
                            />
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold tracking-widest opacity-50">Distribution Link</Label>
                            <div className="flex gap-2">
                              <Input 
                                value={tool.downloadUrl} 
                                onChange={e => setTools(tools.map(t => t.id === tool.id ? {...t, downloadUrl: e.target.value} : t))} 
                                placeholder="https://..."
                                className="flex-1 h-11 rounded-xl bg-background border-none ring-1 ring-border font-medium"
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
                                      toast.success("Binary successfully synchronized!");
                                    } catch (err) {}
                                  }
                                  e.target.value = '';
                                }}
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="icon"
                                className="h-11 w-11 rounded-xl shrink-0 shadow-sm"
                                disabled={isFileUploading}
                                onClick={() => document.getElementById(`edit-file-upload-${tool.id}`)?.click()}
                              >
                                {isFileUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                              </Button>
                            </div>
                            {isFileUploading && (
                              <div className="mt-2 space-y-1.5 px-1">
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-50">
                                  <span>Syncing binary...</span>
                                  <span>{Math.round(fileUploadProgress)}%</span>
                                </div>
                                <Progress value={fileUploadProgress} className="h-1 rounded-full bg-muted shadow-inner" />
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold tracking-widest opacity-50">Visual Asset</Label>
                            <div className="flex gap-2">
                              <div className="flex-1 space-y-3">
                                <Input 
                                  value={tool.imageUrl} 
                                  onChange={e => setTools(tools.map(t => t.id === tool.id ? {...t, imageUrl: e.target.value} : t))} 
                                  placeholder="https://..."
                                  className="h-11 rounded-xl bg-background border-none ring-1 ring-border font-medium"
                                />
                                {tool.imageUrl && (
                                  <div className="relative w-32 h-20 rounded-xl border-2 border-muted/50 overflow-hidden bg-muted group/img shadow-inner transition-all hover:border-primary/30">
                                    <img 
                                      src={tool.imageUrl} 
                                      alt="Preview" 
                                      className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-700"
                                      referrerPolicy="no-referrer"
                                    />
                                    <button 
                                      type="button"
                                      onClick={() => setTools(tools.map(t => t.id === tool.id ? {...t, imageUrl: ''} : t))}
                                      className="absolute inset-0 bg-black/50 backdrop-blur-[1px] text-white opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center font-bold text-[10px] uppercase tracking-wider"
                                    >
                                      Remove Asset
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
                                      toast.success("Asset successfully synchronized!");
                                    } catch (err) {}
                                  }
                                  e.target.value = '';
                                }}
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="icon"
                                className="h-11 w-11 rounded-xl shrink-0 shadow-sm"
                                disabled={isImageUploading}
                                onClick={() => document.getElementById(`edit-image-upload-${tool.id}`)?.click()}
                              >
                                {isImageUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                              </Button>
                            </div>
                            {isImageUploading && (
                              <div className="mt-2 space-y-1.5 px-1">
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-50">
                                  <span>Syncing visual...</span>
                                  <span>{Math.round(imageUploadProgress)}%</span>
                                </div>
                                <Progress value={imageUploadProgress} className="h-1 rounded-full bg-muted shadow-inner" />
                              </div>
                            )}
                          </div>

                          <div className="flex gap-3 pt-4">
                            <Button onClick={() => handleUpdateTool(tool.id, tool)} className="flex-1 h-12 rounded-xl font-bold gap-2 shadow-lg shadow-primary/10">
                              <Save className="w-4 h-4" /> Save Node Changes
                            </Button>
                            <Button variant="outline" onClick={() => setIsEditing(null)} className="h-12 px-8 rounded-xl font-bold">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-[1fr_120px_140px_120px] gap-4 p-4 items-center h-20">
                        <div className="flex items-center gap-4 min-w-0 pl-2">
                          <div className="w-12 h-12 rounded-xl ring-1 ring-border/50 bg-muted/30 overflow-hidden shrink-0 shadow-inner">
                            {tool.imageUrl ? (
                              <img src={tool.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground/20">
                                <ImageIcon className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-base truncate pr-4">{tool.name}</h3>
                            <p className="text-[10px] font-bold opacity-30 truncate uppercase tracking-widest italic">{tool.id.substring(0, 12)}</p>
                          </div>
                        </div>
                        
                        <div>
                          <Badge variant="secondary" className="rounded-full bg-muted/60 text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 border-none">
                            {tool.section}
                          </Badge>
                        </div>

                        <div className="text-[10px] font-bold opacity-40 uppercase tracking-widest">
                          {tool.createdAt ? new Date(tool.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Archive Data'}
                        </div>

                        <div className="flex items-center justify-end gap-2 pr-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                          <Button variant="secondary" size="icon" className="h-9 w-9 rounded-xl shadow-sm hover:bg-primary/10 hover:text-primary" onClick={() => setIsEditing(tool.id)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger
                              render={
                                <Button variant="secondary" size="icon" className="h-9 w-9 rounded-xl shadow-sm border-none text-destructive/60 hover:text-destructive hover:bg-destructive/10">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              }
                            />
                            <AlertDialogContent className="rounded-3xl p-8 border-none ring-1 ring-border shadow-2xl">
                              <AlertDialogHeader className="space-y-4">
                                <AlertDialogTitle className="text-2xl font-extrabold tracking-tight">Confirm Node Purge?</AlertDialogTitle>
                                <AlertDialogDescription className="text-base font-medium leading-relaxed">
                                  Are you absolutely certain? This will permanently delete <span className="text-foreground font-black">"{tool.name}"</span> from the secure repository cluster. This action is catastrophic and irreversible.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="pt-8 gap-3">
                                <AlertDialogCancel className="rounded-xl h-12 px-8 font-bold border-none bg-muted/50 hover:bg-muted text-foreground">Abort</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteTool(tool.id)}
                                  className="rounded-xl h-12 px-10 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold shadow-xl shadow-destructive/20"
                                >
                                  Purge Data
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

        <TabsContent value="categories" className="space-y-8 outline-none">
          <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/50">
              <CardTitle className="text-xl font-bold">Sector Management</CardTitle>
              <CardDescription className="font-medium">Define and organize the operational taxonomy of the repository.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="flex flex-col md:flex-row gap-4 p-6 rounded-2xl bg-muted/20 border border-dashed border-border/50">
                <div className="flex-1 space-y-2">
                  <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60 ml-1">New Sector Identity</Label>
                  <Input 
                    value={newCategory} 
                    onChange={e => setNewCategory(e.target.value)} 
                    placeholder="Enter unique designation code..."
                    className="h-12 border-none bg-background rounded-xl text-lg font-bold px-5 ring-1 ring-border/50 shadow-sm focus-visible:ring-primary/30"
                    onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                  />
                </div>
                <Button onClick={handleAddCategory} className="md:mt-6 h-12 px-10 rounded-xl font-bold gap-2 shadow-lg shadow-primary/10 transition-all hover:-translate-y-0.5">
                  <Plus className="w-5 h-5" /> Append Sector
                </Button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="h-px bg-border/50 flex-1" />
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">Active Manifest</h3>
                  <div className="h-px bg-border/50 flex-1" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {categories.map(cat => (
                    <div key={cat} className="flex items-center justify-between p-4 bg-background rounded-xl border ring-1 ring-border/50 hover:ring-primary/20 hover:shadow-md transition-all group overflow-hidden">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary/20 group-hover:bg-primary transition-colors" />
                        <span className="font-bold text-sm tracking-tight capitalize">{cat}</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-lg text-destructive/40 opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleDeleteCategory(cat)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {categories.length === 0 && <div className="col-span-full text-center py-12 bg-muted/10 rounded-2xl border-2 border-dashed border-border/50 font-medium opacity-40">Global taxonomy manifest is empty.</div>}
                </div>
              </div>

              <div className="space-y-6 pt-8">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">Detected Metadata Cluster (Unsynced)</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {autoSections.filter(s => !categories.includes(s)).map(cat => (
                    <div key={cat} className="flex items-center justify-between p-4 bg-muted/10 rounded-xl border border-dashed border-border/50 transition-all group">
                      <span className="font-bold text-sm opacity-40 capitalize">{cat}</span>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="h-8 rounded-lg text-[10px] font-bold uppercase px-3 opacity-60 group-hover:opacity-100 transition-all hover:bg-primary hover:text-primary-foreground"
                        onClick={() => {
                          setNewCategory(cat);
                          handleAddCategory();
                        }}
                      >
                        Add to Master
                      </Button>
                    </div>
                  ))}
                  {autoSections.filter(s => !categories.includes(s)).length === 0 && (
                    <div className="col-span-full text-xs font-bold uppercase tracking-widest opacity-30 flex items-center justify-center h-20">Global taxonomy cluster is fully synchronized.</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk" className="space-y-8 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="rounded-2xl border-none ring-1 ring-primary/20 bg-primary/5 relative overflow-hidden shadow-sm">
              <div className="absolute -top-16 -right-16 p-4 opacity-5 pointer-events-none">
                <CheckCircle2 className="w-64 h-64 rotate-12" />
              </div>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-primary text-xl font-bold tracking-tight">
                       Automated Extraction
                    </CardTitle>
                    <CardDescription className="font-medium text-primary/60">Synchronize with Master Tool Repositories.</CardDescription>
                  </div>
                  <Badge className="bg-primary/20 text-primary border-none text-[10px] font-bold uppercase px-3 rounded-full">ELITE_LINK</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                <div className="bg-background/40 backdrop-blur-sm border-none ring-1 ring-primary/20 p-4 rounded-xl font-mono text-[10px] leading-relaxed opacity-70 shadow-inner">
                  <span className="text-primary font-bold">// INFILTRATION_SUBNET: ACTIVE</span><br/>
                  <span className="opacity-60">// TARGET_NODE: flingtrainer_official</span><br/>
                  <span className="opacity-60">// AUTH_BYPASS: IMAGE_CHALLENGE_OK</span>
                </div>
                <Button 
                  onClick={handleScrapeFling} 
                  disabled={isScraping}
                  className="w-full h-16 rounded-2xl text-xl font-extrabold tracking-tight shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 active:translate-y-0"
                >
                  {isScraping ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-3">
                      <Plus className="w-6 h-6" />
                      Grab Elite Trainers
                    </span>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold">Manual Bulk Insertion</CardTitle>
                <CardDescription className="font-medium">Direct processing of multiple records via structured CSV stream.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                <div className="bg-muted/30 p-5 rounded-xl border-none ring-1 ring-border/30 space-y-3">
                   <div className="flex items-center gap-2 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Schema Requirements</p>
                   </div>
                  <ul className="text-[11px] font-medium text-muted-foreground/80 space-y-2 pl-1">
                    <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-border" /> Mandatory: <code className="bg-background border rounded px-1.5 py-0.5 text-primary text-[10px] font-bold">name</code>, <code className="bg-background border rounded px-1.5 py-0.5 text-primary text-[10px] font-bold">downloadUrl</code></li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-border" /> Optional: <code className="bg-background border rounded px-1.5 py-0.5 opacity-60 text-[10px] font-bold">description</code>, <code className="bg-background border rounded px-1.5 py-0.5 opacity-60 text-[10px] font-bold">imageUrl</code>, <code className="bg-background border rounded px-1.5 py-0.5 opacity-60 text-[10px] font-bold">section</code></li>
                  </ul>
                  <Button variant="outline" size="sm" onClick={downloadTemplate} className="mt-4 gap-2 rounded-full font-bold px-5 h-9 shadow-sm">
                    <FileDown className="w-4 h-4" />
                    Download Template
                  </Button>
                </div>

                <div className="space-y-4">
                  <Label 
                    htmlFor="csv-upload" 
                    className={`block p-10 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all duration-300 ${
                      isDragging 
                        ? "border-primary bg-primary/5 ring-4 ring-primary/10 shadow-2xl scale-[1.01]" 
                        : "border-border/60 hover:border-primary/40 hover:bg-muted/20"
                    } ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className={`w-16 h-16 mx-auto mb-5 rounded-2xl bg-muted/30 flex items-center justify-center transition-all duration-300 ${isDragging ? "bg-primary/20 text-primary scale-110" : "text-muted-foreground/40 group-hover:text-primary/60"}`}>
                      <Upload className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-base font-bold tracking-tight">
                        {isDragging ? "Feed the stream" : "Drop CSV to inject data"}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Only structural data permitted</p>
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
              <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-top-3 duration-500">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3 text-destructive">
                    <AlertCircle className="w-5 h-5" />
                    <h2 className="text-lg font-bold tracking-tight">Injection Faults ({bulkUploadErrors.length})</h2>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setBulkUploadErrors([])}
                    className="rounded-full font-bold text-xs hover:bg-destructive/10 hover:text-destructive px-5 h-8"
                  >
                    Wipe Fault Log
                  </Button>
                </div>
                <div className="max-h-80 overflow-y-auto rounded-2xl border-none ring-1 ring-border/50 divide-y divide-border/30 bg-muted/10 shadow-inner">
                  {bulkUploadErrors.map((err, idx) => (
                    <div key={idx} className="p-4 text-sm flex items-start gap-4 hover:bg-muted/20 transition-colors">
                      <span className="bg-destructive/20 text-destructive px-3 py-1 rounded-lg font-bold text-[10px] uppercase tracking-widest mt-0.5 shrink-0 shadow-sm">
                        Row {err.row}
                      </span>
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="font-extrabold text-foreground truncate mb-0.5">{err.name}</p>
                        <p className="text-muted-foreground text-[11px] font-medium leading-relaxed italic opacity-80">{err.error}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <AlertDialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
              <AlertDialogContent className="rounded-3xl p-10 border-none ring-1 ring-border shadow-2xl max-w-md">
                <AlertDialogHeader className="space-y-5 text-center">
                  <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
                     <Upload className="w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <AlertDialogTitle className="text-3xl font-extrabold tracking-tight">Confirm Mass Injection</AlertDialogTitle>
                    <AlertDialogDescription className="text-base font-medium leading-relaxed">
                      You are about to inject <span className="font-black text-foreground underline decoration-primary decoration-2 underline-offset-4">{bulkUploadData.length}</span> structured records into the main repository. Verify integrity before proceeding.
                    </AlertDialogDescription>
                  </div>
                </AlertDialogHeader>
                <AlertDialogFooter className="pt-10 flex-col sm:flex-row gap-3">
                  <AlertDialogCancel onClick={() => setBulkUploadData([])} className="rounded-xl h-14 flex-1 font-bold border-none bg-muted/60 hover:bg-muted text-foreground text-lg">Abort Feed</AlertDialogCancel>
                  <AlertDialogAction onClick={handleBulkUpload} className="rounded-xl h-14 flex-1 font-bold shadow-xl shadow-primary/20 text-lg">
                    Execute Inject
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {isUploading && (
              <div className="mt-8 space-y-4 text-center bg-muted/10 p-10 rounded-3xl border border-dashed border-border/50">
                <div className="relative inline-flex h-12 w-12 items-center justify-center">
                   <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                   <Loader2 className="w-5 h-5 text-primary animate-pulse" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-bold tracking-tight">Processing Data Stream...</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">Integrating blocks into global cluster</p>
                </div>
                <div className="w-full max-w-sm mx-auto bg-muted/30 rounded-full h-1.5 overflow-hidden ring-1 ring-border/50">
                  <div className="bg-primary h-full animate-progress-indeterminate shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="outline-none">
          <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/50">
              <CardTitle className="text-xl font-bold">Global Configuration</CardTitle>
              <CardDescription className="font-medium">Define systemic parameters and external communication hooks.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                   <div className="space-y-2">
                    <Label htmlFor="siteName" className="font-bold text-xs uppercase tracking-wider opacity-60 ml-1">Repository Name</Label>
                    <Input 
                      id="siteName" 
                      value={settings.siteName} 
                      onChange={e => setSettings({...settings, siteName: e.target.value})} 
                      placeholder="RX ELITE"
                      className="rounded-xl h-12 bg-muted/20 border-none px-5 font-bold text-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="siteDesc" className="font-bold text-xs uppercase tracking-wider opacity-60 ml-1">System Objective (Bio)</Label>
                    <Textarea 
                      id="siteDesc" 
                      value={settings.siteDescription} 
                      onChange={e => setSettings({...settings, siteDescription: e.target.value})} 
                      placeholder="Premium tool repository..."
                      className="rounded-xl min-h-[140px] bg-muted/20 border-none px-5 py-4 font-medium resize-none leading-relaxed"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="webhook" className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider opacity-60 ml-1">
                      External Comms: Discord Webhook
                    </Label>
                    <Input 
                      id="webhook" 
                      value={settings.discordWebhookUrl} 
                      onChange={e => setSettings({...settings, discordWebhookUrl: e.target.value})} 
                      placeholder="https://discord.com/api/webhooks/..."
                      className="rounded-xl h-12 bg-muted/20 border-none px-5 font-mono text-xs overflow-hidden text-ellipsis"
                    />
                    <div className="flex gap-2 p-4 rounded-xl bg-primary/5 ring-1 ring-primary/10 mt-4">
                       <BellRing className="w-5 h-5 text-primary shrink-0 opacity-60" />
                       <p className="text-[11px] font-bold text-primary/80 leading-snug">
                         System status: Uplink Active. Newly deployed nodes will be broadcasted to this secure channel instantly.
                       </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button onClick={handleSaveSettings} className="w-full h-14 rounded-2xl font-bold text-lg gap-3 shadow-xl shadow-primary/10 transition-all hover:scale-[1.01] active:translate-y-0">
                  <Save className="w-6 h-6" />
                  Preserve Global Config
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

