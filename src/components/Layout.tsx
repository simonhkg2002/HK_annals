import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Search, Sun, Moon, Shield, X, Newspaper, GitBranch } from 'lucide-react';
import { Button, Input } from './ui/primitives';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  hideFooter?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, hideFooter }) => {
  const [isDark, setIsDark] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  // 某些頁面自動隱藏 footer
  const shouldHideFooter = hideFooter || location.pathname === '/series';

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const navLinks = [
    { name: '首頁', path: '/' },
    { name: '日報檔案', path: '/daily' },
    { name: '媒體專區', path: '/media' },
    { name: '系列追蹤', path: '/series', icon: GitBranch },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Mobile Menu Button */}
          <button className="md:hidden mr-2" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X /> : <Menu />}
          </button>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 mr-6">
            <div className="bg-foreground text-background p-1.5 rounded">
                <Newspaper size={24} />
            </div>
            <span className="font-serif font-bold text-xl tracking-tight hidden sm:inline-block">
              HK Chronicle
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            {navLinks.map((link) => (
              <Link 
                key={link.path} 
                to={link.path}
                className={cn(
                  "transition-colors hover:text-foreground/80",
                  isActive(link.path) ? "text-brand-blue font-bold" : "text-foreground/60"
                )}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center flex-1 justify-end space-x-2 md:space-x-4">
            <div className="w-full max-w-xs hidden md:flex">
              <div className="relative w-full">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="搜尋新聞..." className="pl-8 h-9" />
              </div>
            </div>
            
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {isDark ? <Sun className="h-[1.2rem] w-[1.2rem]" /> : <Moon className="h-[1.2rem] w-[1.2rem]" />}
            </Button>
            
            <Link to="/admin">
               <Button variant="ghost" size="icon" className={cn(isActive('/admin') && "text-brand-blue")}>
                 <Shield className="h-[1.2rem] w-[1.2rem]" />
               </Button>
            </Link>
          </div>
        </div>

        {/* Mobile Drawer */}
        {isMenuOpen && (
          <div className="md:hidden border-t p-4 bg-background">
            <div className="space-y-4">
              <div className="relative w-full mb-4">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="搜尋..." className="pl-8" />
              </div>
              <nav className="flex flex-col space-y-3">
                {navLinks.map((link) => (
                  <Link 
                    key={link.path} 
                    to={link.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={cn(
                      "text-lg font-medium py-2 border-b border-border/50",
                       isActive(link.path) ? "text-brand-blue" : "text-foreground/80"
                    )}
                  >
                    {link.name}
                  </Link>
                ))}
                <Link 
                    to="/admin" 
                    onClick={() => setIsMenuOpen(false)}
                    className="text-lg font-medium py-2 text-foreground/80 flex items-center gap-2"
                >
                    管理後台 <Shield size={16}/>
                </Link>
              </nav>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      {!shouldHideFooter && (
        <footer className="border-t py-8 md:py-12 bg-muted/30">
          <div className="container mx-auto px-4 text-center md:text-left">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div>
                   <h4 className="font-serif font-bold text-lg mb-4">HK Chronicle</h4>
                   <p className="text-sm text-muted-foreground">記錄香港每一天。</p>
                </div>
                <div>
                    <h4 className="font-bold mb-4">分類</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        <li>港聞</li>
                        <li>財經</li>
                        <li>國際</li>
                    </ul>
                </div>
                 <div>
                    <h4 className="font-bold mb-4">連結</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        <li>關於我們</li>
                        <li>私隱政策</li>
                    </ul>
                </div>
             </div>
             <div className="mt-8 pt-8 border-t text-center text-xs text-muted-foreground">
                © 2026 HK Daily Chronicle. All rights reserved.
             </div>
          </div>
        </footer>
      )}
    </div>
  );
};
