'use client';

import { useEffect, useState } from 'react';
import { Briefcase, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Position {
  id: string;
  name: string;
  code: string;
  level: number;
  description?: string | null;
  isActive: boolean;
  memberCount: number;
}

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const response = await fetch('/api/admin/positions');
        if (response.ok) {
          const data = await response.json();
          setPositions(data.positions);
        }
      } catch (error) {
        console.error('Failed to fetch positions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPositions();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">役職管理</h1>
        <p className="text-muted-foreground">
          役職の一覧を確認できます
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>役職一覧</CardTitle>
          <CardDescription>
            役職とその所属人数を表示しています（レベルが高いほど上位役職）
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded"></div>
              ))}
            </div>
          ) : positions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              役職が登録されていません
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>役職名</TableHead>
                    <TableHead>コード</TableHead>
                    <TableHead>レベル</TableHead>
                    <TableHead>説明</TableHead>
                    <TableHead>所属人数</TableHead>
                    <TableHead>ステータス</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((position) => (
                    <TableRow key={position.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{position.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {position.code}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{position.level}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {position.description || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {position.memberCount}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={position.isActive ? 'default' : 'secondary'}>
                          {position.isActive ? 'アクティブ' : '無効'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
