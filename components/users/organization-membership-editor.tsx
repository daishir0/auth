'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface Organization {
  id: string;
  name: string;
  code: string;
}

interface Position {
  id: string;
  name: string;
  code: string;
  level: number;
}

interface Membership {
  membershipId: string;
  organization: {
    id: string;
    name: string;
    code: string;
  };
  position: {
    id: string;
    name: string;
  } | null;
  isPrimary: boolean;
}

interface OrganizationMembershipEditorProps {
  userId: string;
  memberships: Membership[];
  onUpdate: () => void;
}

export function OrganizationMembershipEditor({
  userId,
  memberships,
  onUpdate,
}: OrganizationMembershipEditorProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);

  // 新規追加フォームの状態
  const [selectedOrganization, setSelectedOrganization] = useState<string>('');
  const [selectedPosition, setSelectedPosition] = useState<string>('');
  const [isPrimary, setIsPrimary] = useState(false);

  // 組織・役職一覧を取得
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [orgsRes, positionsRes] = await Promise.all([
          fetch('/api/organizations'),
          fetch('/api/positions'),
        ]);

        if (orgsRes.ok) {
          const orgsData = await orgsRes.json();
          setOrganizations(orgsData.organizations || []);
        }

        if (positionsRes.ok) {
          const positionsData = await positionsRes.json();
          setPositions(positionsData.positions || []);
        }
      } catch (error) {
        console.error('Failed to fetch master data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMasterData();
  }, []);

  // 所属追加
  const handleAdd = async () => {
    if (!selectedOrganization) {
      toast.error('組織を選択してください');
      return;
    }

    setAdding(true);
    try {
      const response = await fetch(`/api/users/${userId}/organizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: selectedOrganization,
          positionId: selectedPosition || null,
          isPrimary,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '追加に失敗しました');
      }

      toast.success('所属組織を追加しました');
      setSelectedOrganization('');
      setSelectedPosition('');
      setIsPrimary(false);
      onUpdate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '追加に失敗しました');
    } finally {
      setAdding(false);
    }
  };

  // 所属削除
  const handleDelete = async (membershipId: string) => {
    setDeletingId(membershipId);
    try {
      const response = await fetch(
        `/api/users/${userId}/organizations?membershipId=${membershipId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '削除に失敗しました');
      }

      toast.success('所属組織を削除しました');
      onUpdate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '削除に失敗しました');
    } finally {
      setDeletingId(null);
    }
  };

  // 主所属設定
  const handleSetPrimary = async (membershipId: string) => {
    setSettingPrimaryId(membershipId);
    try {
      const response = await fetch(`/api/users/${userId}/organizations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '主所属の変更に失敗しました');
      }

      toast.success('主所属を変更しました');
      onUpdate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '主所属の変更に失敗しました');
    } finally {
      setSettingPrimaryId(null);
    }
  };

  // 既に所属している組織をフィルタリング
  const availableOrganizations = organizations.filter(
    (org) => !memberships.some((m) => m.organization.id === org.id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 現在の所属一覧 */}
      {memberships.length === 0 ? (
        <p className="text-muted-foreground">所属組織がありません</p>
      ) : (
        <div className="space-y-2">
          {memberships.map((membership) => (
            <div
              key={membership.membershipId}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div className="flex-1">
                <div className="font-medium">{membership.organization.name}</div>
                {membership.position && (
                  <div className="text-sm text-muted-foreground">
                    {membership.position.name}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {membership.isPrimary ? (
                  <Badge variant="default" className="flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    主所属
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetPrimary(membership.membershipId)}
                    disabled={settingPrimaryId === membership.membershipId}
                  >
                    {settingPrimaryId === membership.membershipId ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Star className="h-3 w-3 mr-1" />
                    )}
                    主所属に設定
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(membership.membershipId)}
                  disabled={deletingId === membership.membershipId}
                >
                  {deletingId === membership.membershipId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新規追加フォーム */}
      {availableOrganizations.length > 0 && (
        <div className="border-t pt-4 mt-4">
          <h4 className="text-sm font-medium mb-3">所属を追加</h4>
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Select
                value={selectedOrganization}
                onValueChange={setSelectedOrganization}
              >
                <SelectTrigger>
                  <SelectValue placeholder="組織を選択" />
                </SelectTrigger>
                <SelectContent>
                  {availableOrganizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedPosition || 'none'}
                onValueChange={(val) => setSelectedPosition(val === 'none' ? '' : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="役職を選択（任意）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">なし</SelectItem>
                  {positions.map((pos) => (
                    <SelectItem key={pos.id} value={pos.id}>
                      {pos.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="isPrimary"
                  checked={isPrimary}
                  onCheckedChange={setIsPrimary}
                />
                <Label htmlFor="isPrimary">主所属として設定</Label>
              </div>

              <Button
                onClick={handleAdd}
                disabled={adding || !selectedOrganization}
                size="sm"
              >
                {adding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                追加
              </Button>
            </div>
          </div>
        </div>
      )}

      {availableOrganizations.length === 0 && memberships.length > 0 && (
        <p className="text-sm text-muted-foreground border-t pt-4 mt-4">
          すべての組織に所属しています
        </p>
      )}
    </div>
  );
}
