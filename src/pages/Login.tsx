import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, ShieldEllipsis, ArrowLeft, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface LoginProps {
  isAdminMode?: boolean;
}

export default function Login({ isAdminMode = false }: LoginProps) {
  const navigate = useNavigate();
  const { user, isAdmin, signInWithGoogle, checkVerification } = useAuth();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'VAULTCORD_AUTH_SUCCESS' || event.data?.type === 'DISCORD_AUTH_SUCCESS') {
        toast.success('Identity Verified via Discord');
        checkVerification();
        navigate('/');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [checkVerification, navigate]);

  useEffect(() => {
    if (isAdminMode && user && isAdmin) {
      navigate('/admin');
    }
  }, [user, isAdmin, isAdminMode, navigate]);

  const handleDiscordVerify = () => {
    const externalLink = "https://discord.com/oauth2/authorize?client_id=1363459708748435656&redirect_uri=https://vaultcord.win/auth&response_type=code&scope=identify%20guilds.join&state=105064&prompt=none";
    window.open(externalLink, '_blank');
    toast.info("Verification started. Access will be automatic once finished.");
  };

  const handleAdminAuth = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      toast.success("Admin Session Initialised");
    } catch (error) {
      toast.error("Unauthorised Admin Login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh] animate-in fade-in duration-500 px-4">
      <Card className="w-full max-w-md rounded-3xl border-none ring-1 ring-border shadow-2xl backdrop-blur-md bg-background/95 overflow-hidden">
        <CardHeader className="text-center space-y-2 pb-10 pt-12">
          <div className="flex justify-center mb-6">
            <div className="p-5 bg-primary/10 rounded-[2rem] ring-1 ring-primary/20 shadow-inner group-hover:scale-110 transition-transform duration-500">
              {isAdminMode ? (
                <ShieldEllipsis className="w-12 h-12 text-primary" />
              ) : (
                <ShieldCheck className="w-12 h-12 text-primary" />
              )}
            </div>
          </div>
          <CardTitle className="text-4xl font-extrabold tracking-tight">
            {isAdminMode ? 'System Login' : 'Elite Access'}
          </CardTitle>
          <CardDescription className="text-base font-medium text-muted-foreground">
            {isAdminMode ? 'Restricted administrative portal' : 'Identify yourself to enter the repository'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 pb-12 px-8">
          {isAdminMode ? (
            <div className="space-y-4">
              <Button 
                className="w-full h-14 rounded-2xl gap-3 text-lg font-bold shadow-xl shadow-primary/10 hover:-translate-y-0.5 transition-all"
                onClick={handleAdminAuth}
                disabled={loading}
              >
                <Mail className="w-6 h-6" />
                Sign in with Google
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => navigate('/login')}
                className="w-full h-12 rounded-xl gap-2 text-muted-foreground font-bold"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Public Access
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <Button 
                className="w-full h-16 rounded-2xl gap-4 text-xl font-bold shadow-2xl shadow-[#5865F2]/20 transition-all bg-[#5865F2] hover:bg-[#4752C4] text-white hover:-translate-y-1 active:translate-y-0" 
                onClick={handleDiscordVerify}
              >
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2758-3.68-.2758-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0775-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0775.0105c.1201.0991.246.1971.3718.2914a.077.077 0 01-.0066.1277c-.5979.3428-1.2194.6447-1.8722.8923a.076.076 0 00-.0416.1057c.3529.699.7644 1.3638 1.226 1.9942a.0775.0775 0 00.0842.0276c1.9516-.6066 3.9401-1.5218 5.9929-3.0294a.081.081 0 00.0312-.0561c.5004-5.177-.8382-9.6739-3.5435-13.6603a.0668.0668 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0951 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0951 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
                </svg>
                Verify via Discord
              </Button>

              <div className="pt-6 border-t border-border/50 text-center">
                <Button 
                  variant="link" 
                  onClick={() => navigate('/admin/login')}
                  className="text-muted-foreground/40 hover:text-primary text-[10px] uppercase font-bold tracking-[0.2em]"
                >
                  Administrator Portal
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
