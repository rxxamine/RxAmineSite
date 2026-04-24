import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/src/context/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="rounded-full w-10 h-10 transition-all hover:bg-muted"
      title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
    >
      {theme === 'light' ? (
        <Sun className="h-5 w-5 text-orange-500 animate-in fade-in zoom-in spin-in rotate-0 transition-all" />
      ) : (
        <Moon className="h-5 w-5 text-blue-400 animate-in fade-in zoom-in spin-in rotate-0 transition-all" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
