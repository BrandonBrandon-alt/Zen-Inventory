import React from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { 
  ArrowRightCircle, Truck, Package, Clock, 
  CheckCircle2, AlertCircle, Zap, XCircle, 
  Timer, LogOut, LogIn 
} from "lucide-react";

interface TransferCardProps {
  t: any; // TransferResponse
  branchesMap: Map<number, string>;
  isAdmin: boolean;
  isManager: boolean;
  isInventory: boolean;
  myBranchId: number | null;
  processingId: number | null;
  onApproveDest: (id: number) => void;
  onResolve: (id: number, type: "shrinkage" | "resend" | "claim") => void;
  onResolvingSubmit: (t: any, mode: "cancel" | "reject") => void;
  onPreparing: (t: any) => void;
  onDispatching: (t: any) => void;
  onReceiving: (t: any) => void;
  onViewingReason: (t: any) => void;
}

export default function TransferCard({
  t, branchesMap, isAdmin, isManager, isInventory, myBranchId, processingId,
  onApproveDest, onResolve, onResolvingSubmit, onPreparing, onDispatching, onReceiving, onViewingReason
}: TransferCardProps) {

  const originName = branchesMap.get(t.originBranchId!) || "Sede Desconocida";
  const destName = branchesMap.get(t.destinationBranchId!) || "Sede Desconocida";
  
  // Logic for the Action Banner
  let actionMessage = "";
  let actionColor = "var(--neutral-400)";
  let actionIcon = <Clock size={14} />;

  switch (t.status) {
    case "PENDING":
      actionMessage = `Esperando aprobación de ingreso en ${destName}`;
      actionColor = "var(--color-warning)";
      break;
    case "APPROVED_DEST":
      actionMessage = `Esperando autorización de salida en ${originName}`;
      actionColor = "var(--brand-500)";
      actionIcon = <Timer size={14} />;
      break;
    case "PREPARING":
      actionMessage = `Preparando despacho en ${originName}`;
      actionColor = "var(--color-info)";
      actionIcon = <Package size={14} />;
      break;
    case "IN_TRANSIT":
      actionMessage = `En tránsito hacia ${destName}`;
      actionColor = "var(--color-info)";
      actionIcon = <Truck size={14} />;
      break;
    case "WITH_ISSUE":
      actionMessage = "Novedad en entrega: Requiere resolución";
      actionColor = "var(--color-danger)";
      actionIcon = <AlertCircle size={14} />;
      break;
    case "DELIVERED":
      actionMessage = "Traslado completado con éxito";
      actionColor = "var(--color-success)";
      actionIcon = <CheckCircle2 size={14} />;
      break;
    default:
      actionMessage = t.status === "CANCELLED" ? "Traslado cancelado" : "Traslado rechazado";
      actionColor = "var(--neutral-500)";
      actionIcon = <XCircle size={14} />;
  }

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: "20px", position: "relative", overflow: "hidden" }}>
      {/* Decorative status strip */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "4px", height: "100%", background: actionColor }} />
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "start", gap: "24px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "32px", alignItems: "start" }}>
          
          {/* REDESIGNED ROUTE HEADER */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px 16px", borderRadius: "12px", border: "1px solid var(--border-default)" }}>
               <p style={{ fontSize: "9px", color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                 <LogOut size={10} /> Sale de (Origen)
               </p>
               <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--neutral-100)" }}>{originName}</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
              <ArrowRightCircle size={20} style={{ color: actionColor, opacity: 0.8 }} />
            </div>

            <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px 16px", borderRadius: "12px", border: "1px solid var(--border-default)" }}>
               <p style={{ fontSize: "9px", color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                 <LogIn size={10} /> Llega a (Destino)
               </p>
               <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--neutral-100)" }}>{destName}</p>
            </div>
          </div>

          {/* ACTION INDICATOR BANNER */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: "200px" }}>
            <p style={{ fontSize: "11px", color: "var(--neutral-500)", textTransform: "uppercase", marginBottom: "6px" }}>Estado Actual</p>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "8px", 
              padding: "8px 12px", 
              background: `rgba(${actionColor === 'var(--brand-500)' ? 'var(--brand-500-rgb)' : '255,255,255'}, 0.05)`, 
              borderRadius: "8px",
              border: `1px solid ${actionColor}`,
              color: actionColor
            }}>
              {actionIcon}
              <span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "-0.01em" }}>{actionMessage}</span>
            </div>
          </div>

          <div>
            <p style={{ fontSize: "11px", color: "var(--neutral-500)", textTransform: "uppercase", marginBottom: "4px" }}>Prioridad</p>
            <Badge variant={t.priority === "HIGH" ? "danger" : t.priority === "LOW" ? "neutral" : "info"}>
              {t.priority === "HIGH" ? "ALTA" : t.priority === "LOW" ? "BAJA" : "NORMAL"}
            </Badge>
          </div>

          <div>
            <p style={{ fontSize: "11px", color: "var(--neutral-500)", textTransform: "uppercase", marginBottom: "4px" }}>ID</p>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--neutral-400)" }}>#{t.id}</p>
          </div>

          {(t.status === "CANCELLED" || t.status === "REJECTED") && (t as any).reasonResolution && (
            <div style={{ maxWidth: "400px", marginTop: "4px" }}>
              <p style={{ fontSize: "11px", color: "var(--color-danger)", textTransform: "uppercase", marginBottom: "4px" }}>Motivo de la resolución:</p>
              <div style={{ background: "rgba(217,99,79,0.05)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(217,99,79,0.2)" }}>
                <p style={{ fontSize: "13px", color: "var(--neutral-300)", fontStyle: "italic", lineHeight: "1.5" }}>
                  "{ (t as any).reasonResolution }"
                </p>
                <p style={{ fontSize: "11px", color: "var(--neutral-500)", marginTop: "8px", textAlign: "right" }}>
                  — Por: {(t as any).resolutorNombre || "SISTEMA"}
                </p>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {/* ADMIN: Force-cancel any IN_TRANSIT transfer */}
          {t.status === "IN_TRANSIT" && isAdmin && (
            <Button 
              size="sm" 
              variant="danger" 
              onClick={() => onResolvingSubmit(t, "cancel")} 
              loading={processingId === t.id}
              title="Cancelar forzosamente (Siniestro)"
            >
              <span style={{display: 'flex', gap: '6px', alignItems: 'center'}}><Zap size={14} /> Siniestro</span>
            </Button>
          )}
          {/* PENDING: Manager from destination must approve first */}
          {t.status === "PENDING" && (isAdmin || (isManager && Number(t.destinationBranchId) === Number(myBranchId))) && (
            <div style={{ display: "flex", gap: "8px" }}>
              <Button 
                variant="primary" 
                size="sm" 
                onClick={() => onApproveDest(t.id!)} 
                loading={processingId === t.id}
                style={{ background: "#2ecc71", borderColor: "#27ae60" }}
              >
                <span style={{display: 'flex', gap: '6px', alignItems: 'center'}}><CheckCircle2 size={14} /> Aprobar Entrada</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onResolvingSubmit(t, "reject")} loading={processingId === t.id} style={{ color: "var(--color-danger)" }}>Rechazar</Button>
            </div>
          )}

          {/* APPROVED_DEST: Manager or Inventory from origin must authorize departure */}
          {t.status === "APPROVED_DEST" && (isAdmin || ((isManager || isInventory) && Number(t.originBranchId) === Number(myBranchId))) && (
            <div style={{ display: "flex", gap: "8px" }}>
              <Button 
                variant="primary" 
                size="sm" 
                onClick={() => onPreparing(t)}
                style={{ background: "var(--brand-500)" }}
              >
                <span style={{display: 'flex', gap: '6px', alignItems: 'center'}}><Package size={14} /> Autorizar Salida</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onResolvingSubmit(t, "cancel")} loading={processingId === t.id}>Cancelar</Button>
            </div>
          )}

          {/* PREPARING: Origin branch can dispatch */}
          {t.status === "PREPARING" && (isAdmin || Number(t.originBranchId) === Number(myBranchId)) && (
            <Button variant="primary" size="sm" onClick={() => onDispatching(t)}>
               <span style={{display: 'flex', gap: '6px', alignItems: 'center'}}><Truck size={14} /> Despachar</span>
            </Button>
          )}
          {/* IN_TRANSIT: Destination branch can receive */}
          {t.status === "IN_TRANSIT" && (isAdmin || Number(t.destinationBranchId) === Number(myBranchId)) && (
            <Button variant="primary" size="sm" onClick={() => onReceiving(t)}>Recibir</Button>
          )}
          {/* WITH_ISSUE: Admin or Manager can resolve */}
          {t.status === "WITH_ISSUE" && (isAdmin || isManager) && (
            <div style={{ display: "flex", gap: "8px" }}>
              <Button size="sm" variant="ghost" onClick={() => onResolve(t.id!, "shrinkage")}>Marcar Merma</Button>
              <Button size="sm" variant="ghost" onClick={() => onResolve(t.id!, "resend")}>Reenviar Faltante</Button>
              <Button size="sm" variant="ghost" onClick={() => onResolve(t.id!, "claim")}>Iniciar Reclamación</Button>
            </div>
          )}
        </div>
      </div>

      {/* Detalle de Productos */}
      <div style={{ borderTop: "1px solid var(--border-default)", borderBottom: "1px solid var(--border-default)", padding: "16px 0" }}>
        <p style={{ fontSize: "11px", color: "var(--neutral-500)", textTransform: "uppercase", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
          <Package size={12} /> Productos incluidos
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "12px" }}>
          {t.details?.map((d: any) => (
            <div key={d.id} style={{ background: "rgba(255,255,255,0.02)", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-default)" }}>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--neutral-100)" }}>
                { d.productName || `ID: ${d.productId}` }
              </p>
              <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
                <span style={{ fontSize: "12px", color: "var(--neutral-50)", fontWeight: 700 }}>Solicitado: {d.requestedQuantity}</span>
                {d.sentQuantity! > 0 && <span style={{ fontSize: "12px", color: "var(--brand-400)", fontWeight: 700 }}>Enviado: {d.sentQuantity}</span>}
                {d.receivedQuantity! > 0 && <span style={{ fontSize: "12px", color: "var(--color-success)", fontWeight: 700 }}>Recibido: {d.receivedQuantity}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Línea de Tiempo Logística */}
      <div>
        <p style={{ fontSize: "11px", color: "var(--neutral-500)", textTransform: "uppercase", marginBottom: "16px", display: "flex", alignItems: "center", gap: "6px" }}>
          <Clock size={12} /> Línea de Tiempo Logística
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "0 10px", position: "relative" }}>
          {/* Línea conectora base */}
          <div style={{ position: "absolute", top: "12px", left: "20px", right: "20px", height: "2px", background: "var(--border-default)", zIndex: 0 }} />
          
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", zIndex: 1, position: "relative", minWidth: "120px" }}>
            <div style={{ 
              width: "24px", 
              height: "24px", 
              borderRadius: "50%", 
              background: (t.status === "CANCELLED" || t.status === "REJECTED") ? "var(--color-danger)" : "var(--brand-500)", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              color: "white" 
            }}>
              {t.status === "CANCELLED" || t.status === "REJECTED" ? <XCircle size={12} /> : <Clock size={12} />}
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: (t.status === "CANCELLED" || t.status === "REJECTED") ? "var(--color-danger)" : "var(--neutral-200)" }}>
                {t.status === "CANCELLED" ? "Cancelado" : t.status === "REJECTED" ? "Rechazado" : "Solicitado"}
              </p>
              <p style={{ fontSize: "10px", color: "var(--neutral-500)", marginBottom: "2px" }}>{new Date(t.requestDate!).toLocaleDateString()}</p>
              <p style={{ fontSize: "10px", color: "var(--brand-400)", fontWeight: 600 }}>{t.solicitanteNombre || "Cargando..."}</p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", zIndex: 1, position: "relative", minWidth: "120px" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: (t as any).autorizadorNombre ? "var(--brand-500)" : "var(--neutral-800)", display: "flex", alignItems: "center", justifyContent: "center", color: (t as any).autorizadorNombre ? "white" : "var(--neutral-600)" }}>
              <CheckCircle2 size={12} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: (t as any).autorizadorNombre ? "var(--neutral-200)" : "var(--neutral-600)" }}>Autorizado</p>
              <p style={{ fontSize: "10px", color: "var(--neutral-500)", marginBottom: "2px" }}>{ (t as any).autorizadorNombre ? "✓" : "-" }</p>
              { (t as any).autorizadorNombre && <p style={{ fontSize: "10px", color: "var(--brand-400)", fontWeight: 600 }}>{ (t as any).autorizadorNombre }</p> }
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", zIndex: 1, position: "relative", minWidth: "120px" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: (t as any).dispatchDate ? "var(--brand-500)" : "var(--neutral-800)", display: "flex", alignItems: "center", justifyContent: "center", color: (t as any).dispatchDate ? "white" : "var(--neutral-600)" }}>
              <Truck size={12} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: (t as any).dispatchDate ? "var(--neutral-200)" : "var(--neutral-600)" }}>Despachado</p>
              <p style={{ fontSize: "10px", color: "var(--neutral-500)", marginBottom: "2px" }}>{ (t as any).dispatchDate ? new Date((t as any).dispatchDate).toLocaleDateString() : "-" }</p>
              { (t as any).despachadorNombre && <p style={{ fontSize: "10px", color: "var(--brand-400)", fontWeight: 600 }}>{ (t as any).despachadorNombre }</p> }
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", zIndex: 1, position: "relative", minWidth: "120px" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: t.actualArrivalDate ? "var(--color-success)" : "var(--neutral-800)", display: "flex", alignItems: "center", justifyContent: "center", color: t.actualArrivalDate ? "white" : "var(--neutral-600)" }}>
              <CheckCircle2 size={12} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: t.actualArrivalDate ? "var(--neutral-200)" : "var(--neutral-600)" }}>Recibido</p>
              <p style={{ fontSize: "10px", color: "var(--neutral-500)", marginBottom: "2px" }}>{ t.actualArrivalDate ? new Date(t.actualArrivalDate).toLocaleDateString() : "-" }</p>
              { (t as any).recibidorNombre && <p style={{ fontSize: "10px", color: "#2ecc71", fontWeight: 600 }}>{ (t as any).recibidorNombre }</p> }
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
