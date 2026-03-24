'use client';

import { useEffect, useState } from 'react';
import { OrgTree } from '@/components/organizations/org-tree';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Organization {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  level: number;
  sortOrder: number;
  isActive: boolean;
  parentId?: string | null;
  parent?: { id: string; name: string } | null;
  memberCount: number;
  childCount: number;
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await fetch('/api/admin/organizations');
        if (response.ok) {
          const data = await response.json();
          setOrganizations(data.organizations);
        }
      } catch (error) {
        console.error('Failed to fetch organizations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizations();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">組織管理</h1>
        <p className="text-muted-foreground">
          組織の階層構造を確認できます
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>組織ツリー</CardTitle>
          <CardDescription>
            組織の階層構造と所属人数を表示しています
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded"></div>
              ))}
            </div>
          ) : (
            <OrgTree organizations={organizations} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
