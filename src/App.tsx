/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import Home from '@/src/pages/Home';
import Admin from '@/src/pages/Admin';
import Login from '@/src/pages/Login';
import Navbar from '@/src/components/Navbar';
import Footer from '@/src/components/Footer';
import { AuthProvider } from '@/src/context/AuthContext';
import { ThemeProvider } from '@/src/context/ThemeContext';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';

export default function App() {
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'settings', 'config'));
        console.log("Firebase connection successful.");
      } catch (error: any) {
        console.error("Firebase connection test failed:", error.message, error.code);
        if (error.message.includes('the client is offline')) {
          console.error("Please check if your database is provisioned and your configuration is correct.");
        }
      }
    }
    testConnection();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen flex flex-col bg-background font-sans antialiased text-foreground">
            <Navbar />
            <main className="container mx-auto px-4 py-8 flex-grow">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/admin/login" element={<Login isAdminMode={true} />} />
                <Route path="/admin/*" element={<Admin />} />
              </Routes>
            </main>
            <Footer />
            <Toaster />
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

