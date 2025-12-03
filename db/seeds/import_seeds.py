#!/usr/bin/env python3
"""
Script para importar datos seed a Supabase - Animal Humano
Uso: python import_seeds.py
"""

import csv
import os
import sys
from supabase import create_client
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_KEY:
    print("ERROR: Configura SUPABASE_SERVICE_ROLE_KEY en .env")
    sys.exit(1)

# Crear cliente
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def import_species():
    """Importar especies desde CSV"""
    print("\n" + "="*60)
    print("IMPORTANDO ESPECIES")
    print("="*60)

    with open('species.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        count = 0
        for row in reader:
            try:
                result = supabase.table('species').insert({
                    'name': row['name'],
                    'code': row['code']
                }).execute()
                print(f"  OK {row['name']} ({row['code']})")
                count += 1
            except Exception as e:
                print(f"  ERROR {row['name']}: {e}")

    print(f"\nTotal: {count} especies importadas")
    return count

def import_breeds():
    """Importar razas desde CSV"""
    print("\n" + "="*60)
    print("IMPORTANDO RAZAS")
    print("="*60)

    # Obtener especies
    species_result = supabase.table('species').select('id, name').execute()
    species_map = {s['name']: s['id'] for s in species_result.data}

    with open('breeds.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        count = 0
        skipped = 0

        for row in reader:
            species_id = species_map.get(row['species_name'])

            if not species_id:
                print(f"  SKIP {row['species_name']} - {row['name']}")
                skipped += 1
                continue

            try:
                result = supabase.table('breeds').insert({
                    'species_id': species_id,
                    'name': row['name'],
                    'code': row['code']
                }).execute()
                print(f"  OK {row['species_name']} - {row['name']} ({row['code']})")
                count += 1
            except Exception as e:
                print(f"  ERROR {row['name']}: {e}")
                skipped += 1

    print(f"\nTotal: {count} razas importadas, {skipped} omitidas")
    return count

def import_vaccines():
    """Importar vacunas desde CSV"""
    print("\n" + "="*60)
    print("IMPORTANDO VACUNAS")
    print("="*60)

    # Obtener especies
    species_result = supabase.table('species').select('id, name').execute()
    species_map = {s['name']: s['id'] for s in species_result.data}

    with open('vaccines.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        count = 0
        skipped = 0

        for row in reader:
            species_id = species_map.get(row['species_name'])

            if not species_id:
                print(f"  SKIP {row['species_name']} - {row['name']}")
                skipped += 1
                continue

            try:
                result = supabase.table('vaccines').insert({
                    'species_id': species_id,
                    'name': row['name'],
                    'required': row['required'].lower() == 'true',
                    'description': row['description'],
                    'interval_days': int(row['interval_days']) if row['interval_days'] else None,
                    'contagious_to_humans': row['contagious_to_humans'].lower() == 'true'
                }).execute()
                print(f"  OK {row['species_name']} - {row['name']}")
                count += 1
            except Exception as e:
                print(f"  ERROR {row['name']}: {e}")
                skipped += 1

    print(f"\nTotal: {count} vacunas importadas, {skipped} omitidas")
    return count

def verify_data():
    """Verificar datos importados"""
    print("\n" + "="*60)
    print("VERIFICANDO DATOS")
    print("="*60)

    species_count = len(supabase.table('species').select('id').execute().data)
    breeds_count = len(supabase.table('breeds').select('id').execute().data)
    vaccines_count = len(supabase.table('vaccines').select('id').execute().data)

    print(f"\nEspecies: {species_count}")
    print(f"Razas: {breeds_count}")
    print(f"Vacunas: {vaccines_count}")

    return species_count > 0 and breeds_count > 0 and vaccines_count > 0

def main():
    """Función principal"""
    print("="*60)
    print("ANIMAL HUMANO - IMPORTADOR DE DATOS SEED")
    print("="*60)
    print(f"\nConectando a: {SUPABASE_URL}")

    try:
        # Verificar conexión
        supabase.table('species').select('id').limit(1).execute()
        print("OK - Conexion exitosa")
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

    # Importar datos
    try:
        import_species()
        import_breeds()
        import_vaccines()

        # Verificar
        if verify_data():
            print("\n" + "="*60)
            print("IMPORTACION COMPLETADA EXITOSAMENTE")
            print("="*60)
        else:
            print("\nADVERTENCIA: Revisar datos importados")

    except Exception as e:
        print(f"\nERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
