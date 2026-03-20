"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, FileJson, Github } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function SourcesPage() {
  const sources = [
    { id: '1', name: 'Weather API', type: 'REST', status: 'connected', icon: FileJson, description: 'Open-Meteo hourly forecast API automatically syncing with stg_weather_forecasts.' },
    { id: '2', name: 'E-commerce DB', type: 'PostgreSQL', status: 'connected', icon: Database, description: 'Production replica for transactional customer_orders ingestion.' },
    { id: '3', name: 'GitHub GraphQL', type: 'GraphQL', status: 'connected', icon: Github, description: 'Historical repository commit history stream mapping.' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Sources</h1>
        <p className="text-muted-foreground">Manage and monitor external connections integrating into your ETL pipelines.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {sources.map(s => (
          <Card key={s.id} className="pt-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">{s.name}</CardTitle>
              <s.icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4 pr-4">{s.description}</CardDescription>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="font-mono text-[10px]">{s.type}</Badge>
                <Badge className="bg-emerald-500 hover:bg-emerald-600 capitalize animate-pulse">{s.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
