import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { catchError, interval, of, Subscription, startWith, switchMap } from 'rxjs';

interface Mesa {
  id: number;
  estado: 'libre' | 'ocupada';
  turno: string | null;
  inicio: string | null;
}

interface Estado {
  siguiente_turno: number;
  esperando: string[];
  mesas: Mesa[];
  total_esperando: number;
  mesas_libres: number;
  ultimo_llamado: Llamado | null;
}

interface Llamado {
  turno: string;
  mesa: number;
  llamado_en: string;
}

interface ResultadoTurno {
  turno: string;
  estado: string;
  mesa: number | null;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="app">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">A</div>
          <div>
            <div class="eyebrow">ATENCIÓN AL CLIENTE</div>
            <h1>Turnos</h1>
          </div>
        </div>
        <nav class="main-nav" aria-label="Secciones">
          <button [class.active]="vista === 'recepcion'" [attr.aria-current]="vista === 'recepcion' ? 'page' : null" (click)="cambiarVista('recepcion')">Recepción</button>
          <button [class.active]="vista === 'personal'" [attr.aria-current]="vista === 'personal' ? 'page' : null" (click)="cambiarVista('personal')">Personal</button>
          <button [class.active]="vista === 'pantalla'" [attr.aria-current]="vista === 'pantalla' ? 'page' : null" (click)="cambiarVista('pantalla')">Pantalla</button>
        </nav>
        <div class="connection" [class.disconnected]="!connected">
          <span class="dot" [class.offline]="!connected"></span>
          {{ connected ? 'En línea' : 'Reconectando' }}
        </div>
      </header>

      <main class="page" [ngSwitch]="vista">
        <section *ngSwitchCase="'recepcion'" class="view reception-view">
          <div class="view-heading">
            <span class="eyebrow dark-eyebrow">RECEPCIÓN</span>
            <h2>Toma un turno</h2>
            <p>Te atenderemos en orden de llegada.</p>
          </div>

          <div class="reception-card">
            <div class="reception-action">
              <div class="action-symbol" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
              </div>
              <h3>Comienza aquí</h3>
              <p>Solicita tu turno y mantente atento a los llamados en pantalla.</p>
              <button class="primary" (click)="solicitarTurno()" [disabled]="creatingTurn || !connected">
                {{ creatingTurn ? 'Generando turno…' : 'Tomar un turno' }}
              </button>
            </div>

            <div class="ticket" [class.ticket-waiting]="ultimoTurno && !ultimoTurno.mesa" aria-live="polite">
              <ng-container *ngIf="ultimoTurno; else ticketEmpty">
                <span class="ticket-label">{{ ultimoTurno.mesa ? 'TU TURNO' : 'TURNO EN ESPERA' }}</span>
                <strong>{{ ultimoTurno.turno }}</strong>
                <span class="ticket-destination" *ngIf="ultimoTurno.mesa">Dirígete a la mesa {{ ultimoTurno.mesa }}</span>
                <span class="ticket-destination" *ngIf="!ultimoTurno.mesa">Te avisaremos cuando haya una mesa disponible.</span>
              </ng-container>
              <ng-template #ticketEmpty>
                <span class="ticket-placeholder-icon" aria-hidden="true">
                  <svg viewBox="0 0 48 48"><path d="M8 12h32v7a5 5 0 0 0 0 10v7H8v-7a5 5 0 0 0 0-10z"/><path d="M20 18v3m0 6v3"/></svg>
                </span>
                <span class="ticket-label">TU PASE DE ATENCIÓN</span>
                <span class="ticket-destination">Tu número aparecerá aquí.</span>
              </ng-template>
            </div>
          </div>

          <div class="reception-guide" aria-label="Pasos para recibir atención">
            <div class="guide-step"><span>01</span><div><strong>Toma tu turno</strong><small>Es rápido y sencillo</small></div></div>
            <div class="guide-step"><span>02</span><div><strong>Espera el llamado</strong><small>Verás tu número en pantalla</small></div></div>
            <div class="guide-step"><span>03</span><div><strong>Pasa a tu mesa</strong><small>Te indicaremos cuál</small></div></div>
          </div>
        </section>

        <section *ngSwitchCase="'personal'" class="view staff-view">
          <div class="view-heading heading-row">
            <div>
              <span class="eyebrow dark-eyebrow">OPERACIÓN</span>
              <h2>Control de atención</h2>
              <p>Gestiona las cuatro mesas y sigue la fila de espera.</p>
            </div>
            <button class="secondary reset-button" (click)="reiniciar()" [disabled]="!connected">Reiniciar demo</button>
          </div>

          <section class="metrics" aria-label="Resumen de atención">
            <div class="metric"><span>Personas en espera</span><strong>{{ estado?.total_esperando ?? 0 }}</strong></div>
            <div class="metric"><span>Mesas disponibles</span><strong>{{ estado?.mesas_libres ?? 0 }} <small>/ 4</small></strong></div>
            <div class="metric"><span>Siguiente turno</span><strong>A{{ pad(estado?.siguiente_turno ?? 1) }}</strong></div>
          </section>

          <section class="section-block">
            <div class="section-heading"><h3>Mesas</h3><span>Al finalizar, el siguiente turno pasa automáticamente a esa mesa.</span></div>
            <div class="tables">
              <article class="table-card" *ngFor="let mesa of estado?.mesas" [class.busy]="mesa.estado === 'ocupada'" [class.free]="mesa.estado === 'libre'">
                <div class="table-heading"><div class="table-number">Mesa {{ mesa.id }}</div><span class="status-pill" [class.status-free]="mesa.estado === 'libre'">{{ mesa.estado === 'ocupada' ? 'En atención' : 'Disponible' }}</span></div>
                <div class="table-status">
                  <strong *ngIf="mesa.turno">{{ mesa.turno }}</strong>
                  <strong class="empty-table" *ngIf="!mesa.turno">Lista</strong>
                  <span>{{ mesa.turno ? 'Turno actual' : 'Sin cliente asignado' }}</span>
                </div>
                <div class="actions">
                  <button class="secondary call-next-button" *ngIf="mesa.estado === 'libre' && (estado?.total_esperando ?? 0) > 0" [disabled]="busyMesa === mesa.id || !connected" (click)="atender(mesa.id)">Llamar siguiente aquí</button>
                  <button class="danger" *ngIf="mesa.estado === 'ocupada'" [disabled]="busyMesa === mesa.id || !connected" (click)="finalizar(mesa.id)">{{ (estado?.total_esperando ?? 0) > 0 ? 'Finalizar y llamar siguiente' : 'Finalizar atención' }}</button>
                </div>
              </article>
            </div>
          </section>

          <section class="section-block queue-section">
            <div class="section-heading"><div><h3>Fila de espera</h3><span>Ordenada por llegada</span></div><span class="queue-count">{{ estado?.total_esperando ?? 0 }}</span></div>
            <div class="queue" *ngIf="estado?.esperando?.length; else emptyQueue">
              <article class="queue-item" *ngFor="let turno of estado?.esperando; let position = index">
                <span class="queue-position">{{ position + 1 }}</span>
                <strong>{{ turno }}</strong>
                <span class="queue-order">{{ position === 0 ? 'SIGUIENTE' : 'EN ESPERA' }}</span>
              </article>
            </div>
            <ng-template #emptyQueue><div class="empty"><strong>No hay turnos en espera</strong><span>La fila está al corriente.</span></div></ng-template>
          </section>

          <div class="staff-last-call" *ngIf="estado?.ultimo_llamado as llamado" aria-live="polite">
            <span>Último llamado</span><strong>{{ llamado.turno }}</strong><span>→ Mesa {{ llamado.mesa }}</span>
          </div>
        </section>

        <section *ngSwitchCase="'pantalla'" class="view display-view">
          <div class="display-heading">
            <span class="eyebrow dark-eyebrow">LLAMADO DE TURNOS</span>
            <h2>Atención</h2>
            <p>Por favor, revisa tu número y pasa a la mesa indicada.</p>
          </div>

          <section class="display-call" aria-live="assertive" aria-atomic="true">
            <ng-container *ngIf="estado?.ultimo_llamado as llamado; else noCall">
              <div class="display-turn"><span>Turno</span><strong>{{ llamado.turno }}</strong></div>
              <div class="display-divider"></div>
              <div class="display-destination"><span>Favor de pasar a</span><strong>Mesa {{ llamado.mesa }}</strong></div>
            </ng-container>
            <ng-template #noCall><div class="display-empty"><span>En breve llamaremos al siguiente turno</span><strong>Gracias por esperar</strong></div></ng-template>
          </section>

          <section class="display-active">
            <div class="section-heading"><h3>En atención</h3><span>Mesas ocupadas actualmente</span></div>
            <div class="active-tables">
              <div class="active-table" *ngFor="let mesa of estado?.mesas" [class.active]="mesa.turno">
                <span>Mesa {{ mesa.id }}</span><strong>{{ mesa.turno || '—' }}</strong>
              </div>
            </div>
          </section>

          <section class="display-queue">
            <div class="section-heading"><h3>Próximos turnos</h3><span>{{ estado?.total_esperando ?? 0 }} en espera</span></div>
            <div class="next-turns" *ngIf="estado?.esperando?.length; else noWaiting">
              <span *ngFor="let turno of (estado?.esperando ?? []).slice(0, 5)">{{ turno }}</span>
            </div>
            <ng-template #noWaiting><p class="display-no-waiting">No hay más turnos en espera.</p></ng-template>
          </section>
        </section>
      </main>

      <div class="toast" *ngIf="mensaje" role="status" aria-live="polite">{{ mensaje }}</div>
    </div>
  `,
})
class AppComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private sub?: Subscription;

  api = 'http://localhost:8000/api';
  estado: Estado | null = null;
  ultimoTurno: ResultadoTurno | null = null;
  mensaje = '';
  creatingTurn = false;
  connected = false;
  private wasConnected = false;
  private messageTimer: number | undefined;
  busyMesa: number | null = null;
  vista: 'recepcion' | 'personal' | 'pantalla' = 'recepcion';

  cambiarVista(vista: 'recepcion' | 'personal' | 'pantalla'): void {
    this.vista = vista;
  }

  ngOnInit(): void {
    this.sub = interval(1000).pipe(
      startWith(0),
      switchMap(() => this.http.get<Estado>(`${this.api}/estado/`).pipe(
        catchError(() => {
          this.connected = false;
          this.wasConnected = false;
          return of(null);
        })
      ))
    ).subscribe({
      next: data => {
        if (!data) return;
        this.estado = data;
        if (this.ultimoTurno) {
          const mesaActual = data.mesas.find(mesa => mesa.turno === this.ultimoTurno?.turno);
          if (mesaActual) this.ultimoTurno = { ...this.ultimoTurno, estado: 'atendiendo', mesa: mesaActual.id };
          else if (this.ultimoTurno.estado === 'esperando' && !data.esperando.includes(this.ultimoTurno.turno)) {
            this.ultimoTurno = { ...this.ultimoTurno, estado: 'atendiendo', mesa: data.ultimo_llamado?.turno === this.ultimoTurno.turno ? data.ultimo_llamado.mesa : null };
          }
        }
        this.connected = true;
        if (!this.wasConnected) this.mensaje = '';
        this.wasConnected = true;
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    window.clearTimeout(this.messageTimer);
  }

  private showMessage(message: string): void {
    this.mensaje = message;
    window.clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => this.mensaje = '', 3600);
  }

  solicitarTurno(): void {
    this.creatingTurn = true;
    this.http.post<ResultadoTurno>(`${this.api}/turnos/`, {}).subscribe({
      next: result => {
        this.ultimoTurno = result;
        this.mensaje = '';
        this.creatingTurn = false;
      },
      error: err => {
        this.showMessage(err?.error?.error ?? 'No fue posible generar el turno.');
        this.creatingTurn = false;
      }
    });
  }

  atender(id: number): void {
    this.busyMesa = id;
    this.http.post(`${this.api}/mesas/${id}/atender/`, {}).subscribe({
      next: () => { this.showMessage(`El siguiente turno fue llamado a la Mesa ${id}.`); this.busyMesa = null; },
      error: err => { this.showMessage(err?.error?.error ?? 'No fue posible asignar el turno.'); this.busyMesa = null; }
    });
  }

  finalizar(id: number): void {
    this.busyMesa = id;
    this.http.post<{ siguiente: string | null }>(`${this.api}/mesas/${id}/finalizar/`, {}).subscribe({
      next: result => {
        this.showMessage(result.siguiente
          ? `Turno ${result.siguiente}, favor de pasar a Mesa ${id}.`
          : `Atención finalizada en Mesa ${id}.`);
        this.busyMesa = null;
      },
      error: err => { this.showMessage(err?.error?.error ?? 'No fue posible finalizar.'); this.busyMesa = null; }
    });
  }

  reiniciar(): void {
    if (!confirm('¿Reiniciar todos los turnos?')) return;

    this.http.post(`${this.api}/reiniciar/`, {}).subscribe({
      next: () => {
        this.ultimoTurno = null;
        this.showMessage('Sistema reiniciado.');
      },
      error: () => this.showMessage('No fue posible reiniciar.')
    });
  }

  pad(n: number): string {
    return String(n).padStart(3, '0');
  }
}

bootstrapApplication(AppComponent, {
  providers: [provideHttpClient()]
}).catch(err => console.error(err));
