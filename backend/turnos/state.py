from threading import Lock

from django.utils import timezone

MAX_MESAS = 4

class QueueState:
    def __init__(self):
        self.lock = Lock()
        self.reset()

    def reset(self):
        with getattr(self, "lock", Lock()):
            self.next_number = 1
            self.waiting = []
            self.last_called = None
            self.mesas = [
                {
                    "id": i,
                    "estado": "libre",
                    "turno": None,
                    "inicio": None,
                }
                for i in range(1, MAX_MESAS + 1)
            ]

    def now(self):
        return timezone.localtime(timezone.now()).isoformat(timespec="seconds")

    def public_state(self):
        with self.lock:
            return {
                "siguiente_turno": self.next_number,
                "esperando": list(self.waiting),
                "mesas": [dict(m) for m in self.mesas],
                "total_esperando": len(self.waiting),
                "mesas_libres": sum(1 for m in self.mesas if m["estado"] == "libre"),
                "ultimo_llamado": dict(self.last_called) if self.last_called else None,
            }

    def _find_free_table(self):
        for mesa in self.mesas:
            if mesa["estado"] == "libre":
                return mesa
        return None

    def _assign_next_waiting(self):
        mesa = self._find_free_table()
        if mesa is None or not self.waiting:
            return None

        turno = self.waiting.pop(0)
        mesa["estado"] = "ocupada"
        mesa["turno"] = turno
        mesa["inicio"] = self.now()
        self.last_called = {"turno": turno, "mesa": mesa["id"], "llamado_en": mesa["inicio"]}
        return turno

    def create_turn(self):
        with self.lock:
            turno = f"A{self.next_number:03d}"
            self.next_number += 1

            free = self._find_free_table()
            if free:
                free["estado"] = "ocupada"
                free["turno"] = turno
                free["inicio"] = self.now()
                self.last_called = {"turno": turno, "mesa": free["id"], "llamado_en": free["inicio"]}
                return {
                    "turno": turno,
                    "estado": "atendiendo",
                    "mesa": free["id"],
                }

            self.waiting.append(turno)
            return {
                "turno": turno,
                "estado": "esperando",
                "mesa": None,
            }

    def attend_next(self, mesa_id):
        with self.lock:
            mesa = self._get_mesa(mesa_id)

            if mesa["estado"] == "ocupada":
                return False, "La mesa ya está ocupada.", None

            if not self.waiting:
                return False, "No hay turnos en espera.", None

            turno = self.waiting.pop(0)
            mesa["estado"] = "ocupada"
            mesa["turno"] = turno
            mesa["inicio"] = self.now()
            self.last_called = {"turno": turno, "mesa": mesa_id, "llamado_en": mesa["inicio"]}

            return True, "Turno asignado.", turno

    def finish(self, mesa_id):
        with self.lock:
            mesa = self._get_mesa(mesa_id)

            if mesa["estado"] == "libre":
                return False, "La mesa ya está libre.", None

            turno_finalizado = mesa["turno"]
            mesa["estado"] = "libre"
            mesa["turno"] = None
            mesa["inicio"] = None

            # Regla principal: al desocupar una mesa,
            # el siguiente turno pasa automáticamente a atención.
            nuevo_turno = self._assign_next_waiting()

            return True, "Atención finalizada.", {
                "finalizado": turno_finalizado,
                "siguiente": nuevo_turno,
            }

    def _get_mesa(self, mesa_id):
        try:
            mesa_id = int(mesa_id)
        except (TypeError, ValueError):
            raise ValueError("ID de mesa inválido.")

        if mesa_id < 1 or mesa_id > MAX_MESAS:
            raise ValueError("La mesa debe estar entre 1 y 4.")

        return self.mesas[mesa_id - 1]

state = QueueState()
