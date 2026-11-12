import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useListNotifications, useMarkNotificationRead } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Compass, PlusCircle, Trophy, User, LogOut, Menu, X, Bell, LayoutDashboard, HandHeart } from "lucide-react";
import { Avatar, LoadingScreen } from "./ui";
import { cn } from "@/lib/utils";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { data: user, isLoading, error } = useGetMe({ query: { retry: false } });
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && (error || !user)) {
      setLocation("/auth");
    }
  }, [isLoading, error, user, setLocation]);

  if (isLoading) return <LoadingScreen />;
  if (error || !user) return <LoadingScreen />;

  return <>{children}</>;
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { data: user } = useGetMe();

  const navItems = [
    { href: "/", label: "استكشف الفزعات", icon: Compass },
    { href: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
    { href: "/services/new", label: "اطلب فزعة", icon: PlusCircle },
    { href: "/leaderboard", label: "لوحة الشرف", icon: Trophy },
    { href: "/profile/me", label: "حسابي", icon: User },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-72 bg-card border-l border-border/50 shadow-2xl lg:shadow-none lg:static lg:block transform transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center justify-between border-b border-border/50">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <span className="text-xl font-black text-white">ن</span>
              </div>
              <span className="text-2xl font-black text-gradient-teal tracking-tight">نشمي</span>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 text-muted-foreground">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3.5 rounded-xl font-bold transition-all duration-200 group",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                      : "text-foreground/70 hover:bg-primary/5 hover:text-primary"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive ? "text-secondary" : "opacity-70 group-hover:text-primary")} />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {user && (
            <div className="p-4 m-4 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10">
              <div className="flex items-center gap-3 mb-4">
                <Avatar fallback={user.name} />
                <div>
                  <p className="font-bold text-sm leading-tight">{user.name}</p>
                  <p className="text-xs text-primary font-semibold">{user.level}</p>
                </div>
              </div>
              <div className="flex items-center justify-between bg-white rounded-lg p-2 shadow-sm border border-border/50">
                <span className="text-xs font-bold text-muted-foreground">رصيد النقاط</span>
                <span className="text-sm font-black text-secondary flex items-center gap-1">
                  {user.points} <StarIcon />
                </span>
              </div>
            </div>
          )}
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-20 flex-shrink-0 border-b border-border/50 bg-white/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg bg-primary/5 text-primary hover:bg-primary/10">
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-black text-foreground hidden sm:block">
              {navItems.find(n => n.href === location)?.label || "نشمي"}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <NotificationsMenu />
            {user && (
              <div className="hidden sm:flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-200">
                <span className="text-yellow-700 font-bold text-sm">النقاط: {user.points}</span>
                <StarIcon />
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth relative">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="max-w-7xl mx-auto h-full"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const { data: notifications } = useListNotifications();
  const { mutate: markRead } = useMarkNotificationRead();
  
  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  return (
    <div className="relative">
      <button 
        onClick={() => setOpen(!open)}
        className="relative p-2.5 rounded-xl bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-destructive rounded-full ring-2 ring-white" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute left-0 mt-2 w-80 bg-card rounded-2xl shadow-xl border border-border/50 z-50 overflow-hidden"
            >
              <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
                <h3 className="font-bold">الإشعارات</h3>
                {unreadCount > 0 && <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">{unreadCount} جديد</span>}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {!notifications?.length ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    لا توجد إشعارات حالياً
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {notifications.map(notif => (
                      <div 
                        key={notif.id} 
                        onClick={() => {
                          if (!notif.isRead) markRead({ id: notif.id });
                        }}
                        className={cn(
                          "p-4 border-b last:border-0 hover:bg-black/5 cursor-pointer transition-colors",
                          !notif.isRead ? "bg-primary/5" : ""
                        )}
                      >
                        <h4 className={cn("text-sm mb-1", !notif.isRead ? "font-bold text-primary" : "font-semibold")}>
                          {notif.title}
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{notif.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const StarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-500">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);
