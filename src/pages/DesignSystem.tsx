import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Plus, Settings, Sprout, Trash2, User } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
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
} from '@/components/ui/AlertDialog';
import { Avatar, AvatarFallback, AvatarImage, initialsOf } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/Drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Pagination, pageRange } from '@/components/ui/Pagination';
import { Progress } from '@/components/ui/Progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Separator } from '@/components/ui/Separator';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip';
import { useToast } from '@/store/toast.store';

const brandSwatches = [
  ['50', 'bg-brand-50'],
  ['100', 'bg-brand-100'],
  ['200', 'bg-brand-200'],
  ['300', 'bg-brand-300'],
  ['400', 'bg-brand-400'],
  ['500', 'bg-brand-500'],
  ['600', 'bg-brand-600'],
  ['700', 'bg-brand-700'],
  ['800', 'bg-brand-800'],
  ['900', 'bg-brand-900'],
  ['950', 'bg-brand-950'],
] as const;

const statusSwatches = [
  ['success', 'bg-brand-500'],
  ['info', 'bg-sky-500'],
  ['warning', 'bg-amber-500'],
  ['danger', 'bg-red-500'],
] as const;

const demoRows = [
  { title: 'Weeding — Field A', worker: 'John Ade', due: 'Today, 4:00 PM' },
  { title: 'Fertilization — Field B', worker: 'Mary Bello', due: 'Tomorrow, 10:00 AM' },
  { title: 'Harvesting — Field C', worker: 'Tunde Yusuf', due: 'Fri, 8:00 AM' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function DesignSystem() {
  const { toast } = useToast();
  const [taskName, setTaskName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [category, setCategory] = useState('planting');
  const [sendReminders, setSendReminders] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 2;
  const pageCount = 4;

  const handleSubmit = () => {
    if (!taskName.trim()) {
      setNameError('Please enter a task name.');
      return;
    }
    setNameError(undefined);
    toast({
      variant: 'success',
      title: 'Task created successfully',
      description: `"${taskName.trim()}" is now in To Do.`,
    });
    setTaskName('');
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Design System</h2>
        <p className="mt-1 text-sm text-slate-500">
          The reusable FarmFlow component library. Every page is built from these pieces.
        </p>
      </section>

      <Section title="Colors & typography">
        <div className="flex flex-wrap gap-2">
          {brandSwatches.map(([name, bg]) => (
            <div key={name} className="flex flex-col items-center gap-1">
              <div className={`size-14 rounded-xl ${bg}`} />
              <span className="text-xs text-slate-500">brand-{name}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {statusSwatches.map(([name]) => (
            <Badge key={name} variant={name as 'success' | 'info' | 'warning' | 'danger'}>
              {name}
            </Badge>
          ))}
        </div>
        <Separator />
        <div className="space-y-1">
          <p className="text-2xl font-bold tracking-tight">Heading — clear and confident</p>
          <p className="text-base font-semibold">Subheading — friendly and informative</p>
          <p className="text-sm text-slate-600">Body text — designed to be easy to read with good contrast.</p>
          <p className="text-xs text-slate-500">Caption — supportive detail, less important.</p>
        </div>
      </Section>

      <Section title="Buttons">
        <Row label="Variants">
          <Button variant="primary">Create Task</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Delete</Button>
        </Row>
        <Row label="Sizes & loading">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Add">
            <Plus className="size-5" aria-hidden />
          </Button>
          <Button loading>Working…</Button>
        </Row>
        <Row label="As link">
          <Button asChild>
            <Link to="/tasks?new=1">Quick task link</Link>
          </Button>
        </Row>
      </Section>

      <Section title="Form controls">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="task-name" label="Task name" required error={nameError}>
            <Input
              id="task-name"
              value={taskName}
              placeholder="e.g. Weed Field A"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? 'task-name-error' : undefined}
              onChange={(event) => {
                setTaskName(event.target.value);
                if (nameError) setNameError(undefined);
              }}
            />
            {nameError ? (
              <p id="task-name-error" role="alert" className="text-xs font-medium text-red-600">
                {nameError}
              </p>
            ) : null}
          </FormField>

          <FormField id="task-description" label="Description" hint="Optional notes for the worker.">
            <Textarea id="task-description" placeholder="Any additional instructions…" />
          </FormField>

          <FormField id="category" label="Category">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category" aria-label="Category">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planting">Planting</SelectItem>
                <SelectItem value="weeding">Weeding</SelectItem>
                <SelectItem value="fertilization">Fertilization</SelectItem>
                <SelectItem value="harvest">Harvest</SelectItem>
                <SelectItem value="maintenance">Equipment Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <div className="flex flex-wrap items-center gap-8">
          <div className="flex items-center gap-2">
            <Checkbox id="attach-photos" defaultChecked />
            <Label htmlFor="attach-photos">Attach photos</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="notify-manager" />
            <Label htmlFor="notify-manager">Notify manager</Label>
          </div>
        </div>

        <div className="flex flex-wrap gap-8">
          <RadioGroup defaultValue="morning" aria-label="Preferred time">
            {[
              ['morning', 'Morning'],
              ['afternoon', 'Afternoon'],
              ['evening', 'Evening'],
            ].map(([value, label]) => (
              <div key={value} className="flex items-center space-x-2">
                <RadioGroupItem value={value} id={`time-${value}`} />
                <Label htmlFor={`time-${value}`}>{label}</Label>
              </div>
            ))}
          </RadioGroup>

          <div className="flex items-center gap-3">
            <Switch
              id="reminders"
              checked={sendReminders}
              onCheckedChange={setSendReminders}
            />
            <Label htmlFor="reminders">Send deadline reminders</Label>
          </div>
        </div>

        <Row label="Validation">
          <Button onClick={handleSubmit}>Create Task</Button>
        </Row>
      </Section>

      <Section title="Badges & progress">
        <Row label="Badges">
          <Badge variant="default">To Do</Badge>
          <Badge variant="info">In Progress</Badge>
          <Badge variant="success">Finished</Badge>
          <Badge variant="warning">Due Soon</Badge>
          <Badge variant="danger">Overdue</Badge>
          <Badge variant="outline">Critical</Badge>
        </Row>
        <div className="flex items-center gap-3">
          <span className="w-24 text-sm text-slate-500">Progress 80%</span>
          <Progress value={80} aria-label="Task progress: 80%" className="flex-1" />
        </div>
        <div className="flex items-center gap-3">
          <span className="w-24 text-sm text-slate-500">Progress 35%</span>
          <Progress value={35} aria-label="Task progress: 35%" className="flex-1" />
        </div>
      </Section>

      <Section title="Avatars & tooltip">
        <div className="flex items-center gap-4">
          <Avatar size="sm">
            <AvatarFallback>{initialsOf('John Ade')}</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarImage src="https://i.pravatar.cc/96?img=12" alt="Mary Bello" />
            <AvatarFallback>{initialsOf('Mary Bello')}</AvatarFallback>
          </Avatar>
          <Avatar size="lg">
            <AvatarFallback>{initialsOf('Tunde Yusuf')}</AvatarFallback>
          </Avatar>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Notifications">
                  <Bell className="size-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>You have 3 unread alerts</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </Section>

      <Section title="Dropdown menu">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Options">
              <Settings className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My account</DropdownMenuLabel>
            <DropdownMenuItem>
              <User className="size-4" aria-hidden />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Bell className="size-4" aria-hidden />
              Notifications
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-700 focus:bg-red-50">
              <Trash2 className="size-4" aria-hidden />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="today">
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="overdue">Overdue</TabsTrigger>
          </TabsList>
          <TabsContent value="today" className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
            Today's assignments appear here.
          </TabsContent>
          <TabsContent value="upcoming" className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
            Upcoming deadlines appear here.
          </TabsContent>
          <TabsContent value="overdue" className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
            Overdue work appears here.
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Dialogs & confirmations">
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="size-4" aria-hidden />
                Open dialog
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a farm task</DialogTitle>
                <DialogDescription>
                  Fill in a few details and the task will appear on the board.
                </DialogDescription>
              </DialogHeader>
              <FormField id="dialog-task" label="What needs to be done?">
                <Input id="dialog-task" placeholder="e.g. Inspect irrigation lines" />
              </FormField>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>Create Task</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="danger">Delete task</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. The task and its history will be removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="danger">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Section>

      <Section title="Drawer (mobile)">
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline">
              <Plus className="size-4" aria-hidden />
              Quick add
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerTitle>Quick add</DrawerTitle>
            <DrawerDescription>Add quickly from the field.</DrawerDescription>
            <div className="space-y-3 pt-2">
              <Input placeholder="What needs to be done?" />
              <Input placeholder="Assign to…" />
              <DrawerClose asChild>
                <Button>Create Task</Button>
              </DrawerClose>
            </div>
          </DrawerContent>
        </Drawer>
      </Section>

      <Section title="Alerts">
        <Alert variant="info">
          <AlertTitle>New assignment</AlertTitle>
          <AlertDescription>You have been assigned a new task.</AlertDescription>
        </Alert>
        <Alert variant="success">
          <AlertTitle>Task completed</AlertTitle>
          <AlertDescription>John finished Weeding — Field A.</AlertDescription>
        </Alert>
        <Alert variant="warning">
          <AlertTitle>Due soon</AlertTitle>
          <AlertDescription>Fertilization — Field B is due in 1 hour.</AlertDescription>
        </Alert>
        <Alert variant="danger">
          <AlertTitle>Overdue</AlertTitle>
          <AlertDescription>Weeding — Field C passed its deadline.</AlertDescription>
        </Alert>
      </Section>

      <Section title="Table & pagination">
        <div className="rounded-xl border border-slate-200">
          <Table>
            <TableCaption>Today's pending work</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Worker</TableHead>
                <TableHead className="hidden sm:table-cell">Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demoRows.map((row) => (
                <TableRow key={row.title}>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>{row.worker}</TableCell>
                  <TableCell className="hidden sm:table-cell">{row.due}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <span className="text-sm text-slate-500">{pageRange(8, page, pageSize, 'tasks')}</span>
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </div>
      </Section>

      <Section title="Loading & empty states">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
          <EmptyState
            icon={Sprout}
            title="No tasks yet"
            description="Create your first farm task to start managing today's work."
            action={
              <Button asChild size="sm">
                <Link to="/tasks?new=1">Create Task</Link>
              </Button>
            }
            className="rounded-xl border border-dashed border-slate-300"
          />
          <Alert variant="danger" className="self-start">
            <AlertTitle>Couldn't load tasks</AlertTitle>
            <AlertDescription>
              Please check your internet connection and try again.
              <Button variant="outline" size="sm" className="mt-3">
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </Section>
    </div>
  );
}