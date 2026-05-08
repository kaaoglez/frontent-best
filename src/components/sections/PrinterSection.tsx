'use client';

import { useState, useEffect, useCallback } from 'react';
import { Printer, RefreshCw, Send, Trash2, X, FileText, Clock as ClockIcon } from 'lucide-react';
import type { PrintJob, PrinterInfo } from '@/lib/store';
import { toast } from 'sonner';
import { fetchWithTimeout, formatTimeAgo, printStatusIcon, printStatusLabel, printStatusColor } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

export default function PrinterSection() {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrint, setShowPrint] = useState(false);
  const [printFile, setPrintFile] = useState<{ path: string; name: string } | null>(null);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [printCopies, setPrintCopies] = useState('1');

  const loadData = useCallback(async () => {
    try {
      const [printersRes, jobsRes] = await Promise.all([
        fetch('/api/printers'),
        fetch('/api/printers/jobs'),
      ]);
      if (printersRes.ok) setPrinters((await printersRes.json()).printers);
      if (jobsRes.ok) setJobs((await jobsRes.json()).jobs);
    } catch {
      toast.error('Error cargando datos de impresión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handlePrint = async () => {
    if (!printFile) return;
    try {
      const res = await fetch('/api/printers/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: printFile.name,
          filePath: printFile.path,
          printerName: selectedPrinter || undefined,
          copies: parseInt(printCopies) || 1,
        }),
      });
      if (res.ok) {
        toast.success(`"${printFile.name}" enviado a imprimir`);
        setShowPrint(false);
        setPrintFile(null);
        loadData();
      } else {
        toast.error('Error al enviar impresión');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (!confirm('¿Cancelar este trabajo de impresión?')) return;
    try {
      const res = await fetchWithTimeout('/api/printers/jobs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        toast.success('Trabajo cancelado');
        loadData();
      } else {
        toast.error('Error al cancelar');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleClearQueue = async () => {
    if (!confirm('¿Limpiar toda la cola de impresión? Se eliminarán todos los trabajos.')) return;
    try {
      const res = await fetchWithTimeout('/api/printers/jobs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAll: true }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Cola limpiada (${data.deleted} trabajo(s) eliminado(s))`);
        loadData();
      } else {
        toast.error('Error al limpiar la cola');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const defaultPrinter = printers.find((p) => p.isDefault);

  return (
    <div className="space-y-6">
      {/* Printers */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Printer className="h-5 w-5 text-emerald-600" />
              Impresoras
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : printers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {printers.map((printer) => (
                <div key={printer.name} className="flex items-center gap-3 p-4 rounded-lg border bg-card">
                  <div className={`p-2 rounded-lg ${
                    printer.status === 'Listo' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
                  }`}>
                    <Printer className={`h-5 w-5 ${
                      printer.status === 'Listo' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{printer.name}</p>
                      {printer.isDefault && (
                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200">
                          Predeterminada
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{printer.status}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedPrinter(printer.name);
                        setShowPrint(true);
                      }}
                    >
                      <Send className="h-3.5 w-3.5 mr-1" />
                      Imprimir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Printer className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <p className="font-medium mb-1">No se detectaron impresoras</p>
              <p className="text-sm text-muted-foreground mb-4">Asegúrate de tener CUPS instalado en el servidor</p>
              <Button variant="outline" onClick={() => setShowPrint(true)}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir Archivo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Print Queue */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-amber-600" />
              Cola de Impresión
              {jobs.length > 0 && (
                <Badge variant="secondary" className="text-xs">{jobs.length}</Badge>
              )}
            </CardTitle>
            {jobs.length > 0 && (
              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={handleClearQueue}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Limpiar cola
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {jobs.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {jobs.map((job) => (
                <div key={job.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  {printStatusIcon(job.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{job.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.printerName && `${job.printerName} · `}{job.copies} copia(s) · {formatTimeAgo(job.createdAt)}
                    </p>
                  </div>
                  <Badge className={`text-xs ${printStatusColor(job.status)}`}>
                    {printStatusLabel(job.status)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    title="Cancelar trabajo"
                    onClick={() => handleDeleteJob(job.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No hay trabajos en la cola</p>
          )}
        </CardContent>
      </Card>

      {/* Print Dialog */}
      <Dialog open={showPrint} onOpenChange={setShowPrint}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Imprimir Archivo</DialogTitle>
            <DialogDescription>Selecciona un archivo del servidor para imprimir</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!printFile ? (
              <div className="space-y-3">
                <Label>Ruta del archivo</Label>
                <Input
                  placeholder="/home/z/documento.pdf"
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      setPrintFile({ path: val, name: val.split('/').pop() || val });
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">Escribe la ruta completa del archivo que deseas imprimir</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <FileText className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-sm font-medium">{printFile.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{printFile.path}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto" onClick={() => setPrintFile(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div>
                  <Label>Impresora</Label>
                  <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={defaultPrinter ? `Usar: ${defaultPrinter.name}` : 'Seleccionar impresora'} />
                    </SelectTrigger>
                    <SelectContent>
                      {printers.map((p) => (
                        <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Copias</Label>
                  <Input
                    type="number"
                    min="1"
                    max="99"
                    value={printCopies}
                    onChange={(e) => setPrintCopies(e.target.value)}
                    className="mt-1 w-24"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPrint(false); setPrintFile(null); }}>Cancelar</Button>
            <Button onClick={handlePrint} disabled={!printFile}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
