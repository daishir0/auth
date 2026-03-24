'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Building2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
}

function TreeItem({ node, level }: TreeItemProps) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50 cursor-pointer',
          !node.isActive && 'opacity-50'
        )}
        style={{ paddingLeft: `${level * 24 + 12}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )
        ) : (
          <div className="w-4 shrink-0" />
        )}
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
        </div>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeItem key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function OrgTree({ organizations }: OrgTreeProps) {
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
          <TreeItem key={node.id} node={node} level={0} />
        ))}
      </div>
    </div>
  );
}
