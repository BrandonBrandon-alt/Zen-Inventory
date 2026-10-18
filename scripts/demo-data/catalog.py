"""Catálogo de la empresa de demostración: una distribuidora de materiales de construcción y ferretería.

Todo es determinista (sin azar): los ids de productos, proveedores, unidades, usuarios y sucursales dependen solo de
este archivo, así `clean` sabe exactamente qué borrar sin tocar lo que se cree después con la aplicación.
"""

# Contraseña de todos los usuarios de demostración: Demo-2026*
PASSWORD_HASH = "$2b$10$jEBuXDGBmSTaiEzqTOFuYe.kqA9AiCtBrNJFeaGWMRFTlFBDzuOXO"
DEMO_EMAIL_DOMAIN = "demo.zeninventory.co"

# Unidades que ya existen en la base de datos (V2): 1 UND, 2 KG, 3 BTO, 4 LT, 5 MT.
EXISTING_UNITS = {"UND": 1, "KG": 2, "BTO": 3, "LT": 4, "MT": 5}
NEW_UNITS = [  # (id, nombre, abreviatura)
    (101, "Galón", "GL"),
    (102, "Caja", "CJ"),
    (103, "Rollo", "RL"),
    (104, "Paquete", "PQ"),
    (105, "Par", "PR"),
]
UNIT_IDS = {**EXISTING_UNITS, **{abbr: uid for uid, _name, abbr in NEW_UNITS}}

# Sucursales que ya existen: 1 Sede Central, 2 Sucursal Norte, 3 Sucursal Sur. Las demás son de la demostración.
EXISTING_BRANCHES = {1: "Sede Central", 2: "Sucursal Norte", 3: "Sucursal Sur"}
NEW_BRANCHES = [  # (id, nombre, dirección, teléfono, activa)
    (11, "Sucursal Occidente", "Calle 80 # 69-12, Bogotá", "6017003011", True),
    (12, "Sucursal Chapinero", "Carrera 13 # 58-40, Bogotá", "6017003012", True),
    (13, "Sucursal Soacha", "Autopista Sur # 12-85, Soacha", "6017003013", True),
    (14, "Bodega Antigua (cerrada)", "Calle 13 # 38-20, Bogotá", "6017003014", False),
]
# Tamaño relativo de cada sucursal activa (ventas por día).
BRANCH_SIZE = {1: 1.6, 2: 1.2, 3: 1.0, 11: 0.9, 12: 1.1, 13: 0.6}
# (managers, operadores, vendedores) por sucursal
BRANCH_STAFF = {1: (1, 2, 5), 2: (1, 1, 3), 3: (1, 1, 3), 11: (1, 1, 3), 12: (1, 1, 3), 13: (1, 1, 2)}

FIRST_NAMES = [
    "Andrés", "Camila", "Carlos", "Diana", "Daniel", "Valentina", "Juan", "Laura", "Santiago", "Paula", "Felipe", "Natalia",
    "Sebastián", "Carolina", "Mateo", "Juliana", "Alejandro", "Andrea", "Nicolás", "Mariana", "Cristian", "Lorena", "Hernán",
    "Sandra", "Jorge", "Patricia", "Óscar", "Liliana", "Iván", "Gloria", "Julián", "Marcela", "Esteban", "Viviana", "Camilo",
    "Katherine", "Mauricio", "Yolanda", "Rodrigo", "Isabel", "Fabián", "Tatiana", "Wilson", "Adriana", "Edwin", "Luz Marina",
]
LAST_NAMES = [
    "Rodríguez", "Gómez", "Martínez", "López", "García", "Hernández", "Pérez", "Sánchez", "Ramírez", "Torres", "Díaz", "Vargas",
    "Moreno", "Jiménez", "Rojas", "Castro", "Ortiz", "Romero", "Gutiérrez", "Herrera", "Medina", "Aguilar", "Cardona", "Ospina",
    "Quintero", "Salazar", "Cárdenas", "Rincón", "Arias", "Mejía", "Bernal", "Pardo", "Suárez", "Montoya", "Peña", "Acosta",
]
COMPANY_WORDS = ["Constructora", "Inmobiliaria", "Ingeniería", "Acabados", "Remodelaciones", "Obras Civiles", "Arquitectura", "Mantenimiento"]
COMPANY_NAMES = ["Andina", "Bacatá", "Horizonte", "Alfa", "Prisma", "Cóndor", "Monserrate", "Sabana", "Tequendama", "Cerros", "Delta", "Orión", "Faro", "Nogal"]

# Proveedores: (id, nombre, correo, días de entrega, grupo)
SUPPLIERS = [
    (101, "Cementos Andinos S.A.", "ventas@cementosandinos.com.co", 3, "A"),
    (102, "Aceros del Pacífico Ltda.", "pedidos@acerospacifico.com.co", 4, "B"),
    (103, "Ladrillera San José S.A.S.", "comercial@ladrilleraSanjose.com.co", 3, "C"),
    (104, "Cerámicas del Valle S.A.", "ventas@ceramicasdelvalle.com.co", 5, "D"),
    (105, "Tubosistemas de Colombia", "pedidos@tubosistemas.com.co", 3, "E"),
    (106, "Electro Suministros Bogotá", "ventas@electrosuministros.com.co", 2, "F"),
    (107, "Pinturas Colorín S.A.S.", "pedidos@pinturascolorin.com.co", 2, "G"),
    (108, "Herramientas Industriales HIC", "comercial@hicherramientas.com.co", 4, "H"),
    (109, "Tornillos y Fijaciones TyF", "ventas@tyf.com.co", 2, "I"),
    (110, "Mayorista Constructor S.A.S.", "pedidos@mayoristaconstructor.com.co", 2, "*"),
    (111, "Importadora Ferretera del Norte", "ventas@ifnorte.com.co", 6, "*"),
    (112, "Seguridad Industrial Protec", "ventas@protec.com.co", 3, "H"),
    (113, "Arenas y Triturados del Sur", "despachos@arenasdelsur.com.co", 1, "C"),
    (114, "Eléctricos La Luz Ltda.", "pedidos@electricoslaluz.com.co", 3, "F"),
    (115, "Plásticos y Tanques Andinos", "ventas@plasticosandinos.com.co", 4, "E"),
    (116, "Distribuciones El Constructor", "contacto@elconstructor.com.co", 2, "*"),
]

# Categorías: (nombre, grupo de proveedor, (cantidad mín, máx) por línea de venta, múltiplo de compra, popularidad de la categoría)
CATEGORIES = {
    "CEM": ("Cementos y morteros", "A", (1, 25), 10, 3.0),
    "HIE": ("Hierro y acero", "B", (1, 20), 10, 2.2),
    "MAM": ("Mampostería", "C", (20, 300), 100, 2.4),
    "ACA": ("Pisos y acabados", "D", (1, 10), 4, 1.6),
    "PVC": ("Tubería y plomería", "E", (1, 15), 6, 2.6),
    "ELE": ("Eléctricos", "F", (1, 12), 6, 2.4),
    "PIN": ("Pinturas", "G", (1, 6), 4, 2.0),
    "HER": ("Herramientas y seguridad", "H", (1, 3), 2, 1.5),
    "TOR": ("Tornillería y fijación", "I", (1, 10), 10, 2.0),
}

# (categoría, nombre, unidad, costo en COP, margen, activo)
PRODUCTS = [
    ("CEM", "Cemento Blanco 25Kg", "BTO", 38000, 0.22, True), ("CEM", "Cemento Gris Uso General 42,5Kg", "BTO", 26500, 0.17, True),
    ("CEM", "Mortero de Pega 25Kg", "BTO", 14500, 0.25, True), ("CEM", "Mortero para Estuco 25Kg", "BTO", 12800, 0.26, True),
    ("CEM", "Cal Hidratada 25Kg", "BTO", 9800, 0.28, True), ("CEM", "Yeso de Construcción 25Kg", "BTO", 11500, 0.27, True),
    ("CEM", "Pegante Cerámica Gris 25Kg", "BTO", 17900, 0.27, True), ("CEM", "Pegante Porcelanato 25Kg", "BTO", 21500, 0.28, True),
    ("CEM", "Boquilla Blanca 2Kg", "UND", 8900, 0.35, True), ("CEM", "Boquilla Gris 2Kg", "UND", 8900, 0.35, True),
    ("CEM", "Concreto Premezclado Seco 40Kg", "BTO", 19500, 0.24, True), ("CEM", "Impermeabilizante Integral 1Kg", "UND", 15800, 0.33, True),
    ("CEM", "Cemento Gris 25Kg", "BTO", 15200, 0.18, True), ("CEM", "Mortero Impermeable 25Kg", "BTO", 23900, 0.27, False),
    ("HIE", "Varilla 1/4 x 6m", "UND", 6800, 0.2, True), ("HIE", "Varilla 3/8 x 12m", "UND", 21500, 0.19, True),
    ("HIE", "Varilla 1/2 x 6m", "UND", 23800, 0.19, True), ("HIE", "Varilla 1/2 x 12m", "UND", 46500, 0.18, True),
    ("HIE", "Varilla 5/8 x 6m", "UND", 36500, 0.18, True), ("HIE", "Varilla 3/4 x 6m", "UND", 52000, 0.18, True),
    ("HIE", "Alambre Negro Calibre 18", "KG", 4900, 0.3, True), ("HIE", "Alambre de Amarre", "KG", 5200, 0.3, True),
    ("HIE", "Malla Electrosoldada 15x15", "UND", 189000, 0.16, True), ("HIE", "Ángulo 1\" x 6m", "UND", 41000, 0.21, True),
    ("HIE", "Platina 1\" x 6m", "UND", 28500, 0.22, True), ("HIE", "Tubo Cuadrado 1\" x 6m", "UND", 34500, 0.21, True),
    ("HIE", "Perfil C 6m", "UND", 58000, 0.2, True), ("HIE", "Lámina Zinc Calibre 28 x 3m", "UND", 32000, 0.23, True),
    ("HIE", "Estribo 10x20", "UND", 650, 0.45, True), ("HIE", "Puntilla 2\" con Cabeza", "KG", 6300, 0.32, True),
    ("HIE", "Clavo de Acero 2,5\"", "KG", 6800, 0.32, True), ("HIE", "Varilla 1/4 x 12m", "UND", 13200, 0.2, False),
    ("MAM", "Ladrillo Tolete Rojo", "UND", 980, 0.3, True), ("MAM", "Ladrillo Farol 6x20x40", "UND", 1650, 0.28, True),
    ("MAM", "Bloque No. 5", "UND", 1850, 0.27, True), ("MAM", "Bloque No. 4", "UND", 1650, 0.27, True),
    ("MAM", "Bloque Estructural", "UND", 2750, 0.26, True), ("MAM", "Adoquín Gris", "UND", 2100, 0.3, True),
    ("MAM", "Teja Fibrocemento No. 6", "UND", 38500, 0.22, True), ("MAM", "Teja Termoacústica", "UND", 84000, 0.2, True),
    ("MAM", "Cumbrera Fibrocemento", "UND", 24500, 0.25, True), ("MAM", "Ladrillo Refractario", "UND", 3600, 0.3, True),
    ("MAM", "Arena de Peña Bulto", "BTO", 4300, 0.32, True), ("MAM", "Recebo Bulto", "BTO", 3600, 0.33, True),
    ("MAM", "Triturado 3/4 Bulto", "BTO", 5400, 0.3, True), ("MAM", "Gravilla Fina Bulto", "BTO", 5000, 0.3, True),
    ("ACA", "Porcelanato 60x60 Gris", "CJ", 52000, 0.3, True), ("ACA", "Cerámica Piso 45x45", "CJ", 38000, 0.3, True),
    ("ACA", "Cerámica Pared 30x60", "CJ", 41000, 0.3, True), ("ACA", "Azulejo Cocina 20x30", "CJ", 29500, 0.32, True),
    ("ACA", "Guardaescoba PVC 2,4m", "UND", 8900, 0.35, True), ("ACA", "Zócalo Cerámico", "UND", 3100, 0.4, True),
    ("ACA", "Piso Laminado 8mm", "CJ", 68000, 0.28, True), ("ACA", "Silicona Acrílica Blanca", "UND", 7400, 0.4, True),
    ("ACA", "Silicona Neutra Transparente", "UND", 11900, 0.38, True), ("ACA", "Cinta Antideslizante", "UND", 9500, 0.4, True),
    ("ACA", "Porcelanato 60x60 Beige", "CJ", 54000, 0.3, False),
    ("PVC", "Tubo PVC Presión 1/2\" x 6m", "UND", 11500, 0.3, True), ("PVC", "Tubo PVC Presión 3/4\" x 6m", "UND", 16500, 0.3, True),
    ("PVC", "Tubo PVC Presión 1\" x 6m", "UND", 24800, 0.28, True), ("PVC", "Tubo PVC Sanitario 2\" x 6m", "UND", 38500, 0.28, True),
    ("PVC", "Tubo PVC Sanitario 3\" x 6m", "UND", 59000, 0.27, True), ("PVC", "Tubo PVC Sanitario 4\" x 6m", "UND", 82000, 0.26, True),
    ("PVC", "Codo PVC Presión 1/2\"", "UND", 450, 0.5, True), ("PVC", "Codo Sanitario 2\" x 90°", "UND", 3100, 0.45, True),
    ("PVC", "Tee PVC Presión 1/2\"", "UND", 580, 0.5, True), ("PVC", "Unión PVC Presión 1/2\"", "UND", 380, 0.5, True),
    ("PVC", "Registro de Esfera 1/2\"", "UND", 12500, 0.38, True), ("PVC", "Llave Lavamanos Cromada", "UND", 28500, 0.35, True),
    ("PVC", "Llave Manguera 1/2\"", "UND", 9800, 0.4, True), ("PVC", "Sifón Botella Lavamanos", "UND", 14500, 0.38, True),
    ("PVC", "Tanque Plástico 500L", "UND", 195000, 0.2, True), ("PVC", "Cinta Teflón", "UND", 1200, 0.6, True),
    ("PVC", "Pegante PVC 1/4 Galón", "UND", 17500, 0.35, True), ("PVC", "Limpiador PVC 1/4 Galón", "UND", 15500, 0.35, True),
    ("PVC", "Flexible 1/2\" x 40cm", "UND", 6900, 0.45, True), ("PVC", "Sanitario Económico Blanco", "UND", 198000, 0.24, True),
    ("PVC", "Lavamanos Blanco", "UND", 118000, 0.26, True), ("PVC", "Grifería Ducha Sencilla", "UND", 78000, 0.3, True),
    ("ELE", "Cable THHN No. 12 x 100m", "RL", 195000, 0.22, True), ("ELE", "Cable THHN No. 14 x 100m", "RL", 129000, 0.22, True),
    ("ELE", "Cable THHN No. 10 x 100m", "RL", 310000, 0.2, True), ("ELE", "Cable Dúplex 2x14", "MT", 1900, 0.35, True),
    ("ELE", "Tomacorriente Doble", "UND", 5900, 0.45, True), ("ELE", "Interruptor Sencillo", "UND", 4800, 0.45, True),
    ("ELE", "Interruptor Doble", "UND", 6500, 0.45, True), ("ELE", "Breaker 1x20A", "UND", 9800, 0.38, True),
    ("ELE", "Breaker 1x30A", "UND", 10500, 0.38, True), ("ELE", "Breaker 2x40A", "UND", 27800, 0.34, True),
    ("ELE", "Caja Octogonal", "UND", 950, 0.55, True), ("ELE", "Caja Rectangular 5x10", "UND", 780, 0.55, True),
    ("ELE", "Tubo Conduit 1/2\" x 3m", "UND", 4900, 0.4, True), ("ELE", "Cinta Aislante Negra", "UND", 3200, 0.5, True),
    ("ELE", "Bombillo LED 9W", "UND", 5900, 0.5, True), ("ELE", "Bombillo LED 15W", "UND", 9800, 0.45, True),
    ("ELE", "Panel LED 18W", "UND", 21500, 0.4, True), ("ELE", "Reflector LED 50W", "UND", 34500, 0.38, True),
    ("ELE", "Extensión Eléctrica 5m", "UND", 14500, 0.45, True), ("ELE", "Tablero 6 Circuitos", "UND", 54000, 0.32, True),
    ("ELE", "Portalámpara Rosca", "UND", 2500, 0.55, True), ("ELE", "Fotocelda 220V", "UND", 11800, 0.45, True),
    ("PIN", "Vinilo Tipo 1 Blanco Galón", "GL", 38500, 0.3, True), ("PIN", "Vinilo Tipo 1 Blanco Cuñete", "UND", 168000, 0.27, True),
    ("PIN", "Vinilo Tipo 2 Blanco Galón", "GL", 24500, 0.32, True), ("PIN", "Vinilo Tipo 3 Blanco Galón", "GL", 16900, 0.34, True),
    ("PIN", "Esmalte Sintético Blanco Galón", "GL", 52000, 0.3, True), ("PIN", "Esmalte Sintético Negro Galón", "GL", 52000, 0.3, True),
    ("PIN", "Anticorrosivo Gris Galón", "GL", 41500, 0.3, True), ("PIN", "Laca Transparente Galón", "GL", 56000, 0.3, True),
    ("PIN", "Thinner Galón", "GL", 23500, 0.35, True), ("PIN", "Varsol Galón", "GL", 21500, 0.35, True),
    ("PIN", "Estuco Plástico Galón", "GL", 19800, 0.35, True), ("PIN", "Sellador Acrílico Galón", "GL", 27500, 0.33, True),
    ("PIN", "Brocha 2\"", "UND", 3900, 0.6, True), ("PIN", "Brocha 4\"", "UND", 7200, 0.55, True),
    ("PIN", "Rodillo 9\" con Felpa", "UND", 9800, 0.5, True), ("PIN", "Bandeja para Pintura", "UND", 4500, 0.55, True),
    ("PIN", "Lija de Madera No. 120", "UND", 1200, 0.7, True), ("PIN", "Lija al Agua No. 220", "UND", 1500, 0.7, True),
    ("PIN", "Cinta de Enmascarar 24mm", "UND", 4200, 0.5, True), ("PIN", "Espátula 3\"", "UND", 5900, 0.5, True),
    ("PIN", "Aerosol Negro Mate", "UND", 11900, 0.4, True), ("PIN", "Aerosol Blanco Brillante", "UND", 11900, 0.4, True),
    ("HER", "Martillo de Uña 16oz", "UND", 21500, 0.4, True), ("HER", "Mazo de Caucho", "UND", 18500, 0.4, True),
    ("HER", "Destornillador de Estrella", "UND", 6500, 0.5, True), ("HER", "Destornillador de Pala", "UND", 6200, 0.5, True),
    ("HER", "Alicate Universal 8\"", "UND", 17500, 0.42, True), ("HER", "Pinzas Eléctricas", "UND", 23500, 0.4, True),
    ("HER", "Llave Inglesa 10\"", "UND", 28900, 0.4, True), ("HER", "Cinta Métrica 5m", "UND", 9800, 0.5, True),
    ("HER", "Nivel de Burbuja 24\"", "UND", 19500, 0.42, True), ("HER", "Escuadra Metálica", "UND", 12900, 0.45, True),
    ("HER", "Serrucho 20\"", "UND", 16500, 0.45, True), ("HER", "Segueta con Marco", "UND", 9500, 0.5, True),
    ("HER", "Hojas de Segueta x 12", "PQ", 4800, 0.55, True), ("HER", "Pala Redonda", "UND", 38500, 0.35, True),
    ("HER", "Pica con Cabo", "UND", 42500, 0.35, True), ("HER", "Carretilla Reforzada", "UND", 189000, 0.25, True),
    ("HER", "Taladro Percutor 1/2\"", "UND", 189000, 0.28, True), ("HER", "Pulidora 4 1/2\"", "UND", 169000, 0.28, True),
    ("HER", "Disco de Corte Metal 4 1/2\"", "UND", 3900, 0.6, True), ("HER", "Disco Diamantado 4 1/2\"", "UND", 18500, 0.45, True),
    ("HER", "Broca para Concreto 1/4\"", "UND", 3500, 0.6, True), ("HER", "Juego de Brocas x 13", "PQ", 28500, 0.42, True),
    ("HER", "Candado 40mm", "UND", 14500, 0.45, True), ("HER", "Guantes de Carnaza", "PR", 8500, 0.5, True),
    ("HER", "Guantes de Nitrilo", "PR", 4500, 0.55, True), ("HER", "Casco de Seguridad", "UND", 14900, 0.5, True),
    ("HER", "Gafas de Seguridad", "UND", 5900, 0.6, True), ("HER", "Tapabocas Desechable x 50", "CJ", 12000, 0.5, True),
    ("HER", "Botas Pantaneras", "PR", 54000, 0.35, True), ("HER", "Chaleco Reflectivo", "UND", 11500, 0.5, True),
    ("TOR", "Tornillo Drywall 6x1\" x 100", "CJ", 7900, 0.5, True), ("TOR", "Tornillo 8x2\" x 100", "CJ", 9500, 0.5, True),
    ("TOR", "Chazo Plástico 1/4\" x 100", "PQ", 3800, 0.6, True), ("TOR", "Chazo Expansivo 3/8\"", "UND", 1200, 0.7, True),
    ("TOR", "Puntilla 1\" con Cabeza", "KG", 7200, 0.35, True), ("TOR", "Puntilla 3\" con Cabeza", "KG", 6800, 0.35, True),
    ("TOR", "Tuerca 3/8\" x 50", "PQ", 4900, 0.55, True), ("TOR", "Arandela Plana 3/8\" x 50", "PQ", 3400, 0.55, True),
    ("TOR", "Perno 3/8\" x 3\"", "UND", 1100, 0.65, True), ("TOR", "Remache Pop x 100", "PQ", 5400, 0.55, True),
    ("TOR", "Silicona en Barra x 10", "PQ", 5000, 0.5, True), ("TOR", "Pegante Epóxico 2 Componentes", "UND", 12900, 0.45, True),
    ("TOR", "Soldadura 6013 1/8\"", "KG", 11500, 0.35, True), ("TOR", "Pegante de Contacto Galón", "GL", 49500, 0.3, True),
    ("TOR", "Cinta Doble Faz", "UND", 5900, 0.5, True), ("TOR", "Abrazadera Metálica 1\"", "UND", 1500, 0.65, True),
    ("TOR", "Bisagra 3\" Zincada", "PR", 4600, 0.55, True), ("TOR", "Cerradura de Alcoba", "UND", 54000, 0.33, True),
    ("TOR", "Cerradura de Baño", "UND", 49500, 0.33, True), ("TOR", "Pasador de Seguridad 4\"", "UND", 5200, 0.55, True),
]

PRODUCT_ID_START = 101
PRODUCT_COUNT = len(PRODUCTS)
USER_ID_START = 101
FIRST_DEMO_PRODUCT = PRODUCT_ID_START
LAST_DEMO_PRODUCT = PRODUCT_ID_START + PRODUCT_COUNT - 1
