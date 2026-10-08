from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from .state import state, MAX_MESAS


@api_view(["GET"])
def estado(request):
    return Response(state.public_state())


@api_view(["POST"])
def crear_turno(request):
    resultado = state.create_turn()
    return Response(resultado, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def atender(request, mesa_id):
    try:
        ok, message, turno = state.attend_next(mesa_id)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=400)

    if not ok:
        return Response({"error": message}, status=409)

    return Response({
        "message": message,
        "mesa": int(mesa_id),
        "turno": turno,
    })


@api_view(["POST"])
def finalizar(request, mesa_id):
    try:
        ok, message, data = state.finish(mesa_id)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=400)

    if not ok:
        return Response({"error": message}, status=409)

    return Response({
        "message": message,
        "mesa": int(mesa_id),
        **data,
    })


@api_view(["POST"])
def reiniciar(request):
    state.reset()
    return Response({
        "message": "Sistema reiniciado.",
        "estado": state.public_state(),
    })
