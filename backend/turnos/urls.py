from django.urls import path
from .views import estado, crear_turno, atender, finalizar, reiniciar

urlpatterns = [
    path("estado/", estado),
    path("turnos/", crear_turno),
    path("mesas/<int:mesa_id>/atender/", atender),
    path("mesas/<int:mesa_id>/finalizar/", finalizar),
    path("reiniciar/", reiniciar),
]
