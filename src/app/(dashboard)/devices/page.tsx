"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, RefreshCw, Wifi, WifiOff, Thermometer, Activity, Camera, Monitor, Play, Square, Zap, Download, Upload, Radar } from "lucide-react";
import { clientEngine, type Device } from "@/lib/client-engine";
import { edgeIntelligence, type EdgeAnalysisResult } from "@/lib/edge-intelligence";
import { toast } from "sonner";

const DEVICE_TYPES = [
  { value: "sensor", label: "Capteur", subtypes: ["temperature", "microphone", "camera", "motion"] },
  { value: "actuator", label: "Actionneur", subtypes: ["relay", "servo", "led", "motor", "valve"] },
  { value: "camera", label: "Caméra", subtypes: ["ip", "usb", "rtsp"] },
] as const;

const DEFAULT_DEVICES: Omit<Device, "createdAt" | "updatedAt">[] = [
  { id: "camera-main", name: "Caméra principale", type: "camera", subtype: "ip", ipAddress: "192.168.1.100", port: 8080, isActive: true, metadata: { resolution: "1920x1080" } },
  { id: "mic-main", name: "Micro principal", type: "sensor", subtype: "microphone", ipAddress: "192.168.1.101", port: 8080, isActive: true, metadata: { threshold: 80 } },
  { id: "temp-main", name: "Température principale", type: "sensor", subtype: "temperature", ipAddress: "192.168.1.102", port: 8080, isActive: true, metadata: { threshold: 35, unit: "°C" } },
  { id: "relay-1", name: "Relais principal", type: "actuator", subtype: "relay", ipAddress: "192.168.1.103", port: 8080, isActive: true, metadata: {} },
  { id: "servo-1", name: "Servo d'orientation", type: "actuator", subtype: "servo", ipAddress: "192.168.1.104", port: 8080, isActive: true, metadata: { position: 90 } },
];

async function seedDevicesIfNeeded() {
  const existing = await clientEngine.getAllDevices();
  if (existing.length > 0) return existing;

  for (const device of DEFAULT_DEVICES) {
    await clientEngine.upsertDevice(device);
  }

  return DEFAULT_DEVICES.map((d) => ({ ...d, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })) as Device[];
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [form, setForm] = useState<{ id: string; name: string; type: "sensor" | "actuator" | "camera"; subtype: string; ipAddress: string; port: string; metadata: string }>({ id: "", name: "", type: "sensor", subtype: "", ipAddress: "", port: "", metadata: "{}" });
  const [testingId, setTestingId] = useState<string | null>(null);
  const [previewDeviceId, setPreviewDeviceId] = useState<string | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [importInput, setImportInput] = useState("");
  const [bridgeStatus, setBridgeStatus] = useState<{ detected: boolean; url?: string; latency?: number }>({ detected: false });
  const [connectingBridge, setConnectingBridge] = useState(false);
  const [edgeActive, setEdgeActive] = useState(false);
  const [edgeResults, setEdgeResults] = useState<EdgeAnalysisResult[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      await clientEngine.init();
      const all = await seedDevicesIfNeeded();
      setDevices(all);
      const bridge = await clientEngine.detectBridge();
      setBridgeStatus(bridge);
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleConnectBridge = async () => {
    if (!bridgeStatus.url) return;
    setConnectingBridge(true);
    try {
      const result = await clientEngine.connectBridge(bridgeStatus.url);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Erreur de connexion au bridge");
    } finally {
      setConnectingBridge(false);
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const discovered = await clientEngine.scanLocalDevices();
      let added = 0;
      for (const device of discovered) {
        const exists = devices.some((d) => d.id === device.id || d.ipAddress === device.ipAddress);
        if (!exists) {
          await clientEngine.upsertDevice(device);
          added++;
        }
      }
      toast.success(`${added} nouveau(x) périphérique(s) découvert(s)`);
      await loadDevices();
    } catch {
      toast.error("Erreur lors de la découverte");
    } finally {
      setDiscovering(false);
    }
  };

  const handleExport = async () => {
    try {
      const json = await clientEngine.exportDevices();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `devices-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Configuration exportée");
    } catch {
      toast.error("Erreur lors de l'export");
    }
  };

  const handleImport = async () => {
    if (!importInput.trim()) {
      toast.error("Veuillez coller le JSON de configuration");
      return;
    }
    try {
      const result = await clientEngine.importDevices(importInput.trim());
      toast.success(`${result.imported} périphérique(s) importé(s)`);
      setImportInput("");
      await loadDevices();
    } catch {
      toast.error("JSON invalide");
    }
  };

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    return () => {
      if (previewStream) {
        previewStream.getTracks().forEach((track) => track.stop());
      }
      edgeIntelligence.stop();
    };
  }, [previewStream]);

  const handleToggleEdge = async () => {
    if (edgeActive) {
      edgeIntelligence.stop();
      setEdgeActive(false);
      return;
    }

    try {
      const cameraDevices = devices.filter((d) => d.type === "camera" && d.isActive);
      const targetDevice = cameraDevices.find((d) => d.id === selectedCameraId) || cameraDevices[0];
      if (!targetDevice) {
        toast.error("Aucune caméra disponible pour l'analyse");
        return;
      }

      setSelectedCameraId(targetDevice.id);
      const stream = await edgeIntelligence.startCamera();
      setPreviewStream(stream);

      const videoEl = document.createElement("video");
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.srcObject = stream;
      edgeIntelligence.attachVideo(videoEl);

      edgeIntelligence.onAnalysis((result) => {
        setEdgeResults((prev) => [result, ...prev].slice(0, 50));
        if (result.hasAnomaly) {
          toast.warning(`Anomalie détectée sur ${targetDevice.name} (confiance: ${Math.round(result.confidence * 100)}%)`);
        }
      });

      edgeIntelligence.startAnalysis({ deviceId: targetDevice.id });
      setEdgeActive(true);
      toast.success(`Analyse temps réel démarrée sur ${targetDevice.name}`);
    } catch {
      toast.error("Impossible de démarrer l'analyse locale");
    }
  };

  const handleOpenDialog = (device?: Device) => {
    if (device) {
      setEditingDevice(device);
      setForm({
        id: device.id,
        name: device.name,
        type: device.type,
        subtype: device.subtype ?? "",
        ipAddress: device.ipAddress ?? "",
        port: device.port ? String(device.port) : "",
        metadata: JSON.stringify(device.metadata ?? {}, null, 2),
      });
    } else {
      setEditingDevice(null);
      setForm({ id: "", name: "", type: "sensor", subtype: "", ipAddress: "", port: "", metadata: "{}" });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.id.trim() || !form.name.trim()) {
      toast.error("L'identifiant et le nom sont requis");
      return;
    }

    try {
      const device = {
        id: form.id.trim(),
        name: form.name.trim(),
        type: form.type,
        subtype: form.subtype || null,
        ipAddress: form.ipAddress.trim() || null,
        port: form.port ? Number(form.port) : null,
        isActive: true,
        metadata: (() => { try { return JSON.parse(form.metadata); } catch { return {}; } })(),
      };

      await clientEngine.upsertDevice(device);
      toast.success(editingDevice ? "Périphérique mis à jour" : "Périphérique ajouté");
      setDialogOpen(false);
      await loadDevices();
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await clientEngine.deleteDevice(id);
      toast.success("Périphérique supprimé");
      await loadDevices();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleTestConnection = async (device: Device) => {
    if (!device.ipAddress) {
      toast.error("Adresse IP manquante");
      return;
    }
    setTestingId(device.id);
    try {
      const result = await clientEngine.testDeviceConnection(device.ipAddress, device.port);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Erreur lors du test de connexion");
    } finally {
      setTestingId(null);
    }
  };

  const handlePreview = async (device: Device) => {
    if (previewDeviceId === device.id) {
      setPreviewDeviceId(null);
      if (previewStream) {
        previewStream.getTracks().forEach((track) => track.stop());
        setPreviewStream(null);
      }
      return;
    }

    if (previewStream) {
      previewStream.getTracks().forEach((track) => track.stop());
    }

    setPreviewDeviceId(device.id);
    toast.info("Recherche du flux vidéo...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setPreviewStream(stream);
      toast.success("Aperçu actif");
    } catch {
      toast.error("Impossible d'accéder à la caméra. Vérifiez les permissions.");
      setPreviewDeviceId(null);
    }
  };

  const getDeviceIcon = (device: Device) => {
    if (device.type === "camera") return <Camera className="h-5 w-5" />;
    if (device.type === "sensor") {
      if (device.subtype === "temperature") return <Thermometer className="h-5 w-5" />;
      return <Activity className="h-5 w-5" />;
    }
    if (device.type === "actuator") return <Zap className="h-5 w-5" />;
    return <Monitor className="h-5 w-5" />;
  };

  const getDeviceColor = (device: Device) => {
    if (device.type === "camera") return "text-violet-500 bg-violet-500/10";
    if (device.type === "sensor") return "text-emerald-500 bg-emerald-500/10";
    if (device.type === "actuator") return "text-amber-500 bg-amber-500/10";
    return "text-blue-500 bg-blue-500/10";
  };

  const grouped = devices.reduce<Record<string, Device[]>>((acc, device) => {
    const type = device.type === "camera" ? "camera" : device.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(device);
    return acc;
  }, {});

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Gestion des périphériques</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {devices.length} périphérique{devices.length > 1 ? "s" : ""} enregistré{devices.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadDevices} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
          {bridgeStatus.detected ? (
            <Button variant="default" size="sm" onClick={handleConnectBridge} disabled={connectingBridge} className="gap-1.5 text-xs">
              {connectingBridge ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Bridge {bridgeStatus.latency ? `${bridgeStatus.latency}ms` : ""}
            </Button>
          ) : (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <WifiOff className="h-3 w-3" />
              Bridge hors ligne
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleDiscover} disabled={discovering} className="gap-1.5 text-xs">
            {discovering ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />}
            Découvrir
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            Exporter
          </Button>
          <Dialog open={!!importInput} onOpenChange={(open) => !open && setImportInput("")}>
            <DialogTrigger>
              <Button variant="outline" size="sm" onClick={() => setImportInput("")} className="gap-1.5 text-xs">
                <Upload className="h-3.5 w-3.5" />
                Importer
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Importer une configuration</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="import">JSON de configuration</Label>
                  <textarea id="import" value={importInput} onChange={(e) => setImportInput(e.target.value)} className="w-full h-40 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono" placeholder="Collez le JSON exporté ici..." />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setImportInput("")}>Annuler</Button>
                <Button onClick={handleImport}>Importer</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger>
              <Button size="sm" onClick={() => handleOpenDialog()} className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingDevice ? "Modifier le périphérique" : "Ajouter un périphérique"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="id">Identifiant *</Label>
                  <Input id="id" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} disabled={!!editingDevice} placeholder="ex: temp-01" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nom *</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex: Capteur température salle A" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value as "sensor" | "actuator" | "camera", subtype: "" })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEVICE_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subtype">Sous-type</Label>
                    <Select value={form.subtype} onValueChange={(value) => setForm({ ...form, subtype: value as string })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {(DEVICE_TYPES.find((t) => t.value === form.type)?.subtypes ?? []).map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ipAddress">Adresse IP</Label>
                    <Input id="ipAddress" value={form.ipAddress} onChange={(e) => setForm({ ...form, ipAddress: e.target.value })} placeholder="192.168.1.100" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input id="port" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} placeholder="8080" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metadata">Métadonnées (JSON)</Label>
                  <textarea id="metadata" value={form.metadata} onChange={(e) => setForm({ ...form, metadata: e.target.value })} className="w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" placeholder='{"threshold": 35}' />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleSave}>{editingDevice ? "Mettre à jour" : "Ajouter"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">Chargement des périphériques...</CardContent>
        </Card>
      ) : devices.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <Monitor className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Aucun périphérique enregistré.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([type, typeDevices]) => (
            <div key={type}>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold capitalize">{type === "camera" ? "Caméras" : type === "sensor" ? "Capteurs" : "Actionneurs"}</h2>
                <Badge variant="secondary" className="text-[10px]">{typeDevices.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {typeDevices.map((device) => (
                  <Card key={device.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${getDeviceColor(device)}`}>
                            {getDeviceIcon(device)}
                          </div>
                          <div>
                            <CardTitle className="text-base font-semibold text-foreground">{device.name}</CardTitle>
                            <p className="text-xs text-muted-foreground font-mono">{device.id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {device.isActive ? (
                            <Badge variant="default" className="text-[9px] gap-1"><Wifi className="h-2.5 w-2.5" />Actif</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[9px] gap-1"><WifiOff className="h-2.5 w-2.5" />Inactif</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                        {device.ipAddress && <span className="px-2 py-1 rounded-md bg-muted/50">IP: {device.ipAddress}</span>}
                        {device.port && <span className="px-2 py-1 rounded-md bg-muted/50">Port: {device.port}</span>}
                        {device.subtype && <span className="px-2 py-1 rounded-md bg-muted/50 capitalize">{device.subtype}</span>}
                      </div>
                      {Object.keys(device.metadata).length > 0 && (
                        <div className="text-[10px] text-muted-foreground bg-muted/20 rounded-md p-2 font-mono">
                          {JSON.stringify(device.metadata)}
                        </div>
                      )}
                      <Separator />
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="outline" size="sm" onClick={() => handleTestConnection(device)} disabled={testingId === device.id || !device.ipAddress} className="flex-1 text-xs gap-1.5">
                          {testingId === device.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Wifi className="h-3 w-3" />}
                          Tester
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleOpenDialog(device)} className="text-xs">
                          Configurer
                        </Button>
                        {device.type === "camera" && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => handlePreview(device)} className="text-xs gap-1.5">
                              {previewDeviceId === device.id ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                              Aperçu
                            </Button>
                            <Button variant={selectedCameraId === device.id && edgeActive ? "default" : "outline"} size="sm" onClick={handleToggleEdge} className="text-xs gap-1.5">
                              <Activity className="h-3 w-3" />
                              {edgeActive && selectedCameraId === device.id ? "Arrêter IA" : "IA locale"}
                            </Button>
                          </>
                        )}
                         <Button variant="ghost" size="icon" onClick={() => handleDelete(device.id)} className="text-destructive h-9 w-9">
                           <Trash2 className="h-4 w-4" />
                         </Button>
                      </div>
                      {selectedCameraId === device.id && edgeActive && edgeResults.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-[10px] text-muted-foreground">Analyses récentes :</p>
                          {edgeResults.slice(0, 5).map((result, idx) => (
                            <div key={idx} className={`flex items-center justify-between rounded-lg border p-2 text-[10px] ${result.hasAnomaly ? "border-red-500/30 bg-red-500/5" : "border-border/50 bg-background/50"}`}>
        <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{result.labels.join(", ")}</span>
                                {result.hasAnomaly && <Badge variant="destructive" className="text-[8px]">ANOMALIE</Badge>}
                              </div>
                              <span className="text-muted-foreground">{Math.round(result.confidence * 100)}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {previewDeviceId === device.id && (
                        <div className="mt-3 rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
                          <div className="aspect-video bg-black flex items-center justify-center relative">
                            {previewStream ? (
                              <video autoPlay playsInline muted className="w-full h-full object-cover" ref={(el) => { if (el) el.srcObject = previewStream; }} />
                            ) : (
                              <div className="text-center text-muted-foreground">
                                <Camera className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-xs">Aperçu non disponible</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
