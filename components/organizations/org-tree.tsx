'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronDown, Building2, Users, Trash2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

interface OrgTreeProps {
  organizations: Organization[];
  onRefresh?: () => void;
}

interface TreeNode extends Organization {
  children: TreeNode[];
}

function buildTree(organizations: Organization[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // まず全ノードをマップに登録
  organizations.forEach((org) => {
    map.set(org.id, { ...org, children: [] });
  });

  // 親子関係を構築
  organizations.forEach((org) => {
    const node = map.get(org.id)!;
    if (org.parentId && map.has(org.parentId)) {
      map.get(org.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // 各階層をソート
  const sortNodes = (nodes: TreeNode[]): void => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(roots);
  return roots;
}

interface TreeItemProps {
  node: TreeNode;
  level: number;
  onRefresh?: () => void;
}

function TreeItem({ node, level, onRefresh }: TreeItemProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(level < 2);
  const [deleting, setDeleting] = useState(false);
  const hasChildren = node.children.length > 0;
  const canDelete = node.memberCount === 0 && node.childCount === 0 && node.children.length === 0;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/organizations/${node.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('組織を削除しました');
        onRefresh?.();
      } else {
        const data = await response.json();
        if (data.error === 'Cannot delete organization with active children') {
          toast.error('子組織がある組織は削除できません');
        } else if (data.error === 'Cannot delete organization with active members') {
          toast.error('メンバーがいる組織は削除できません');
        } else {
          toast.error(data.error || '削除に失敗しました');
        }
      }
    } catch (error) {
      console.error('Failed to delete organization:', error);
      toast.error('削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

  const handleNavigate = () => {
    router.push(`/organizations/${node.id}`);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      setExpanded(!expanded);
    }
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50 cursor-pointer group',
          !node.isActive && 'opacity-50'
        )}
        style={{ paddingLeft: `${level * 24 + 12}px` }}
        onClick={handleNavigate}
      >
        <div onClick={handleToggle} className="shrink-0">
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <div className="w-4" />
          )}
        </div>
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{node.name}</div>
          <div className="text-xs text-muted-foreground">{node.code}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            {node.memberCount}
          </div>
          {!node.isActive && (
            <Badge variant="secondary">無効</Badge>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity',
                  !canDelete && 'cursor-not-allowed'
                )}
                disabled={!canDelete || deleting}
                onClick={(e) => e.stopPropagation()}
              >
                {deleting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>組織を削除しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  「{node.name}」を削除します。この操作は取り消せません。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>削除</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeItem key={child.id} node={child} level={level + 1} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
}

export function OrgTree({ organizations, onRefresh }: OrgTreeProps) {
  const tree = buildTree(organizations);

  if (organizations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        組織が登録されていません
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <div className="p-2">
        {tree.map((node) => (
          <TreeItem key={node.id} node={node} level={0} onRefresh={onRefresh} />
        ))}
      </div>
    </div>
  );
}
