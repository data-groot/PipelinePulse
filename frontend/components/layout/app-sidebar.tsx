"use client";

import { useQuery } from '@tanstack/react-query';
import { fetchPipelines } from "@/lib/api";
import { Activity, LayoutDashboard, ListTree, Database, ShieldCheck } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { usePathname, useRouter } from "next/navigation";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  
  const { data: pipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: fetchPipelines,
  });
  
  const navItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Pipelines", url: "/pipelines", icon: ListTree },
    { title: "Quality", url: "/quality", icon: ShieldCheck },
    { title: "Sources", url: "/sources", icon: Database },
  ];

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar/50 backdrop-blur-xl">
      <SidebarHeader className="p-4 flex flex-row items-center gap-2">
        <div className="bg-primary/20 p-2 rounded-lg ring-1 ring-primary/30">
          <Activity className="h-5 w-5 text-primary" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-lg tracking-tight">PipelinePulse</span>
          <span className="text-xs text-muted-foreground uppercase font-mono tracking-wider">Observability</span>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[10px] uppercase">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    onClick={() => router.push(item.url)} 
                    isActive={pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url))} 
                    tooltip={item.title} 
                    className="cursor-pointer transition-all hover:bg-sidebar-accent/50 data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium group relative overflow-hidden"
                  >
                    {pathname === item.url && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                    )}
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {pipelines && pipelines.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="font-mono text-[10px] uppercase">Active Pipelines</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {pipelines.map((pipe: any) => (
                  <SidebarMenuItem key={pipe.id}>
                    <SidebarMenuButton onClick={() => router.push(`/pipelines`)} tooltip={pipe.name} className="cursor-pointer transition-all hover:bg-sidebar-accent/50">
                      <div className={`h-2 w-2 rounded-full ${pipe.enabled ? "bg-emerald-500 shadow-[0_0_8px_theme(colors.emerald.500)]" : "bg-muted shadow-none"}`} />
                      <span className="truncate">{pipe.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
