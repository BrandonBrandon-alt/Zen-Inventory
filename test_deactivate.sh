#!/bin/bash
# Encuentra el ID del primer producto
PID=$(docker exec zenvory-db psql -U postgres -d inventario_multisucursal -t -c "SELECT id FROM producto LIMIT 1;" | xargs)
echo "Testing with Product ID: $PID"

# Como no tenemos JWT fácil aquí, vamos a simular el cambio en DB primero para ver si el front lo lee
docker exec zenvory-db psql -U postgres -d inventario_multisucursal -c "UPDATE producto SET activa = false WHERE id = $PID;"
docker exec zenvory-db psql -U postgres -d inventario_multisucursal -c "SELECT id, sku, activa FROM producto WHERE id = $PID;"
