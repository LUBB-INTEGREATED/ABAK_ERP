'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, PowerOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useAdminServices,
  useCategoriesList,
  useCreateCategory,
  useCreateService,
  useDeactivateService,
  useUpdateService,
  type AdminService,
} from '@/lib/hooks/use-services';
import { useAuthStore } from '@/lib/auth';

export default function AdminServicesPage() {
  const user = useAuthStore((state) => state.user);
  const services = useAdminServices(true);
  const categories = useCategoriesList(true);
  const [editing, setEditing] = useState<AdminService | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  if (user && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          You need an admin role to manage the service catalog. Ask your
          workspace admin for access.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-abak-blue">Service catalog</h1>
          <p className="text-sm text-muted-foreground">
            Maintain the services your team quotes against.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCategoryOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" /> New category
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New service
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Base price</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!services.isLoading &&
                services.data?.map((svc) => (
                  <TableRow
                    key={svc.id}
                    className="cursor-pointer"
                    onClick={() => setEditing(svc)}
                  >
                    <TableCell className="font-mono text-sm">
                      {svc.code}
                    </TableCell>
                    <TableCell className="font-medium">{svc.name}</TableCell>
                    <TableCell>{svc.category?.name}</TableCell>
                    <TableCell>
                      {svc.basePrice !== null
                        ? `${svc.basePrice.toLocaleString()} SAR`
                        : '—'}
                    </TableCell>
                    <TableCell>{svc.unit ?? '—'}</TableCell>
                    <TableCell>
                      {svc.isActive ? (
                        <Badge className="border-transparent bg-emerald-100 text-emerald-700">
                          Active
                        </Badge>
                      ) : (
                        <Badge className="border-transparent bg-zinc-100 text-zinc-600">
                          Archived
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditing(svc);
                        }}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editing && (
        <ServiceDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          service={editing}
          categories={categories.data ?? []}
        />
      )}
      {createOpen && (
        <ServiceDialog
          open
          onOpenChange={setCreateOpen}
          service={null}
          categories={categories.data ?? []}
        />
      )}
      {categoryOpen && <CategoryDialog open onOpenChange={setCategoryOpen} />}
    </div>
  );
}

function ServiceDialog({
  open,
  onOpenChange,
  service,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: AdminService | null;
  categories: { id: string; name: string }[];
}) {
  const [categoryId, setCategoryId] = useState(
    service?.categoryId ?? categories[0]?.id ?? '',
  );
  const [name, setName] = useState(service?.name ?? '');
  const [code, setCode] = useState(service?.code ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [basePrice, setBasePrice] = useState(
    service?.basePrice !== null && service?.basePrice !== undefined
      ? String(service.basePrice)
      : '',
  );
  const [unit, setUnit] = useState(service?.unit ?? '');
  const [isActive, setIsActive] = useState(service?.isActive ?? true);

  const createMutation = useCreateService();
  const updateMutation = useUpdateService();
  const deactivateMutation = useDeactivateService();
  const pending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deactivateMutation.isPending;

  async function submit() {
    const body = {
      categoryId,
      name: name.trim(),
      code: code.trim(),
      description: description.trim() || undefined,
      basePrice: basePrice.trim() ? Number(basePrice) : undefined,
      unit: unit.trim() || undefined,
      isActive,
    };

    try {
      if (service) {
        await updateMutation.mutateAsync({ id: service.id, body });
        toast.success('Service updated');
      } else {
        await createMutation.mutateAsync(body);
        toast.success('Service created');
      }
      onOpenChange(false);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'Failed to save';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  async function deactivate() {
    if (!service) return;
    try {
      await deactivateMutation.mutateAsync(service.id);
      toast.success('Service archived');
      onOpenChange(false);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'Failed to archive';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {service ? `Edit ${service.code}` : 'New service'}
          </DialogTitle>
          <DialogDescription>
            Services show up in the lead-intake service dropdown.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="basePrice">Base price (SAR)</Label>
            <Input
              id="basePrice"
              type="number"
              value={basePrice}
              onChange={(event) => setBasePrice(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <Input
              id="unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              placeholder="per project"
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <input
              id="isActive"
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="isActive">Active (visible to sales team)</Label>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {service && service.isActive && (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={deactivate}
              disabled={pending}
            >
              <PowerOff className="mr-2 h-4 w-4" />
              Deactivate
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={pending || !name || !code || !categoryId}
            >
              {service ? 'Save changes' : 'Create service'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [order, setOrder] = useState('0');
  const mutation = useCreateCategory();

  async function submit() {
    try {
      await mutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        icon: icon.trim() || undefined,
        order: Number(order) || 0,
        isActive: true,
      });
      toast.success('Category created');
      onOpenChange(false);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'Failed to save';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New category</DialogTitle>
          <DialogDescription>
            Categories group services together in the catalog.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="catName">Name</Label>
            <Input
              id="catName"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="catIcon">Icon (lucide name, optional)</Label>
            <Input
              id="catIcon"
              value={icon}
              onChange={(event) => setIcon(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="catOrder">Sort order</Label>
            <Input
              id="catOrder"
              type="number"
              value={order}
              onChange={(event) => setOrder(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="catDescription">Description</Label>
            <Textarea
              id="catDescription"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending || !name}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
