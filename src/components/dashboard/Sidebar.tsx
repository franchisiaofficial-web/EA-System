"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, BookOpen, CheckSquare, GraduationCap,
  HeartPulse, AlertCircle, FileText, Building2, ChevronDown,
  PanelLeftClose, PanelLeft, LogOut, Calendar, School, Library,
  Bus, Banknote, Megaphone, MessageSquare, ChartBar, ShieldCheck,
  ClipboardList, Clock, BookMarked, UserPlus, ArrowRightCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuthContext } from "@/lib/auth/context";

interface NavItem { label: string; href: string; icon: React.ElementType; roles: string[]; disabled?: boolean; tooltip?: string; }
interface NavGroup { title: string; items: NavItem[]; }

const SCHOOL_GROUPS: NavGroup[] = [
  { title: "", items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: [] }] },
  { title: "ACADEMICS", items: [
    { label: "Academic Years", href: "/dashboard/academics/academic-years", icon: Calendar, roles: ["SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"] },
    { label: "Classes & Sections", href: "/dashboard/academics/classes", icon: School, roles: ["SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"] },
    { label: "Students", href: "/dashboard/academics/students", icon: Users, roles: ["SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"] },
    { label: "Promotion", href: "/dashboard/academics/promotion", icon: ArrowRightCircle, roles: ["SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"] },
    { label: "Staff", href: "/dashboard/staff", icon: GraduationCap, roles: [], disabled: true, tooltip: "In Development" },
    { label: "Subjects", href: "/dashboard/academics/subjects", icon: BookOpen, roles: ["SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"] },
    { label: "Curriculum", href: "/dashboard/academics", icon: BookMarked, roles: [], disabled: true, tooltip: "In Development" },
    { label: "Timetable", href: "/dashboard/academics/timetable", icon: Clock, roles: ["SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"] },
    { label: "Attendance", href: "/dashboard/academics/attendance", icon: CheckSquare, roles: ["SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"] },
    { label: "Examinations", href: "/dashboard/academics/exams", icon: ClipboardList, roles: ["SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"] },
    { label: "Marks & Reports", href: "/dashboard/academics", icon: ChartBar, roles: [], disabled: true, tooltip: "In Development" },
  ]},
  { title: "ADMISSIONS", items: [
    { label: "Admissions", href: "/dashboard/academics", icon: UserPlus, roles: [], disabled: true, tooltip: "In Development" },
    { label: "Enrollment", href: "/dashboard/academics/students", icon: ClipboardList, roles: [], disabled: true, tooltip: "In Development" },
  ]},
  { title: "FINANCE", items: [
    { label: "Fees", href: "/dashboard/academics/fees", icon: Banknote, roles: ["SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"] },
    { label: "Payments", href: "/dashboard/academics/fees", icon: Banknote, roles: [], disabled: true, tooltip: "In Development" },
  ]},
  { title: "COMMUNICATION", items: [
    { label: "Announcements", href: "/dashboard/academics", icon: Megaphone, roles: [], disabled: true, tooltip: "In Development" },
    { label: "Messages", href: "/dashboard/academics", icon: MessageSquare, roles: [], disabled: true, tooltip: "In Development" },
  ]},
  { title: "OPERATIONS", items: [
    { label: "Transport", href: "/dashboard/academics/transport", icon: Bus, roles: ["SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"] },
    { label: "Library", href: "/dashboard/academics/library", icon: Library, roles: ["SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"] },
  ]},
  { title: "REPORTS", items: [
    { label: "Attendance Reports", href: "/dashboard/academics", icon: ChartBar, roles: [], disabled: true, tooltip: "In Development" },
    { label: "Student Reports", href: "/dashboard/academics", icon: Users, roles: [], disabled: true, tooltip: "In Development" },
  ]},
  { title: "SETTINGS", items: [
    { label: "School Settings", href: "/dashboard/settings", icon: Building2, roles: ["SCHOOL_ADMIN", "PRINCIPAL"] },
    { label: "School Profile", href: "/dashboard/academics", icon: ShieldCheck, roles: [], disabled: true, tooltip: "In Development" },
    { label: "Roles & Permissions", href: "/dashboard/academics", icon: ShieldCheck, roles: [], disabled: true, tooltip: "In Development" },
    { label: "Audit Logs", href: "/dashboard/super-admin/audit-logs", icon: FileText, roles: ["SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"] },
  ]},
];

const TEACHER_GROUPS: NavGroup[] = [
  { title: "", items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: [] }] },
  { title: "TEACHING", items: [
    { label: "Attendance", href: "/dashboard/teacher/attendance", icon: CheckSquare, roles: ["TEACHER", "CLASS_TEACHER"] },
    { label: "Students", href: "/dashboard/academics/students", icon: Users, roles: ["TEACHER", "CLASS_TEACHER"] },
    { label: "Timetable", href: "/dashboard/academics/timetable", icon: Clock, roles: ["TEACHER", "CLASS_TEACHER"] },
  ]},
];
const STUDENT_GROUPS: NavGroup[] = [
  { title: "", items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: [] }] },
  { title: "MY SCHOOL", items: [
    { label: "Attendance", href: "/dashboard/student/attendance", icon: CheckSquare, roles: ["STUDENT"] },
  ]},
];
const SUPER_ADMIN_GROUPS: NavGroup[] = [
  { title: "", items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: [] }] },
  { title: "OPERATIONS", items: [
    { label: "School Management", href: "/dashboard/super-admin/schools", icon: Building2, roles: ["SUPER_ADMIN"] },
    { label: "Platform Health", href: "/dashboard/super-admin/platform-health", icon: HeartPulse, roles: ["SUPER_ADMIN"] },
    { label: "Error Logs", href: "/dashboard/super-admin/error-logs", icon: AlertCircle, roles: ["SUPER_ADMIN"] },
    { label: "Audit Logs", href: "/dashboard/super-admin/audit-logs", icon: FileText, roles: ["SUPER_ADMIN"] },
  ]},
];

export function Sidebar({ authCtx, mobileOpen, onClose }: { authCtx: AuthContext; mobileOpen: boolean; onClose: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const groups = authCtx.role === "SUPER_ADMIN" ? SUPER_ADMIN_GROUPS : authCtx.role === "TEACHER" || authCtx.role === "CLASS_TEACHER" ? TEACHER_GROUPS : authCtx.role === "STUDENT" ? STUDENT_GROUPS : SCHOOL_GROUPS;

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-40 flex flex-col transition-all duration-200 lg:translate-x-0",
      "bg-background border-r border-border",
      mobileOpen ? "translate-x-0" : "-translate-x-full",
      collapsed ? "w-[72px]" : "w-[264px]"
    )}>
      <div className={cn("flex items-center h-14 px-3 border-b border-border", collapsed ? "justify-center" : "gap-2.5")}>
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0" title="EA System">
          <img src="/logo.png" alt="EA System" className="h-[38px] w-auto object-contain" />
          {!collapsed && <span className="font-mono text-sm font-semibold text-foreground tracking-tight">EA System</span>}
        </Link>
        <button onClick={() => setCollapsed(!collapsed)} className={cn("ml-auto p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors", collapsed && "ml-0")}>
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4 scrollbar-thin">
        {groups.map((group) => {
          const visible = group.items.filter((item) => item.roles.length === 0 || item.roles.includes(authCtx.role));
          if (visible.length === 0) return null;
          return <NavGroup key={group.title || "main"} title={group.title} items={visible} collapsed={collapsed} pathname={pathname} onItemClick={onClose} />;
        })}
      </nav>

      <div className={cn("border-t border-border p-3", collapsed ? "px-1.5" : "")}>
        <UserPanel authCtx={authCtx} collapsed={collapsed} />
      </div>
    </aside>
  );
}

function NavGroup({ title, items, collapsed, pathname, onItemClick }: { title: string; items: NavItem[]; collapsed: boolean; pathname: string; onItemClick: () => void }) {
  const [open, setOpen] = useState(true);
  if (collapsed) return <div className="space-y-0.5">{items.map((item) => <NavItemLink key={item.label} item={item} collapsed pathname={pathname} onItemClick={onItemClick} />)}</div>;
  return (
    <div>
      {title && (
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 w-full px-2 py-1 mb-1 text-[10px] font-mono font-bold text-muted-foreground/60 uppercase tracking-[0.15em] hover:text-muted-foreground transition-colors">
          <ChevronDown className={cn("h-3 w-3 transition-transform duration-150", open ? "" : "-rotate-90")} />{title}
        </button>
      )}
      {open && <div className="space-y-0.5">{items.map((item) => <NavItemLink key={item.label} item={item} collapsed={false} pathname={pathname} onItemClick={onItemClick} />)}</div>}
    </div>
  );
}

function NavItemLink({ item, collapsed, pathname, onItemClick }: { item: NavItem; collapsed: boolean; pathname: string; onItemClick: () => void }) {
  const isActive = item.disabled ? false : item.href === "/dashboard" ? pathname === "/dashboard" : pathname === item.href || pathname.startsWith(item.href + "/");

  if (item.disabled) {
    return (
      <div className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground/35 cursor-not-allowed", collapsed && "justify-center px-0")} title={item.tooltip}>
        <item.icon className="h-4 w-4 shrink-0 opacity-30" />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {!collapsed && <span className="ml-auto text-[9px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Soon</span>}
      </div>
    );
  }

  return (
    <Link href={item.href} onClick={onItemClick} title={collapsed ? item.label : undefined}
      className={cn("group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
        collapsed && "justify-center px-0",
        isActive
          ? "bg-ea-green/10 text-ea-green border-l-2 border-ea-green"
          : "text-muted-foreground border-l-2 border-transparent hover:bg-muted hover:text-foreground"
      )}>
      <item.icon className={cn("h-4 w-4 shrink-0 transition-colors duration-150", isActive ? "text-ea-green" : "text-muted-foreground group-hover:text-foreground")} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function UserPanel({ authCtx, collapsed }: { authCtx: AuthContext; collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-ea-green/15 flex items-center justify-center text-xs font-mono font-bold text-ea-green">{authCtx.email.charAt(0).toUpperCase()}</div>
        <button className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Sign Out">
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2.5 px-2 py-1.5 mb-2">
        <div className="h-8 w-8 rounded-lg bg-ea-green/15 flex items-center justify-center text-xs font-mono font-bold text-ea-green shrink-0">
          {authCtx.email.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{authCtx.email}</p>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{authCtx.role.replace(/_/g, " ")}</p>
        </div>
        <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Sign Out">
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
