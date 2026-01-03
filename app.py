#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serveur Flask pour Les Yeux de Mona
- Sert les fichiers statiques du site
- Gère les appels à l'API OpenAI
- Met à jour le fichier artworks.json avec les informations générées par l'IA
"""

import os
import json
import requests
import yaml
from flask import Flask, send_from_directory, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

app = Flask(__name__, static_folder='site', static_url_path='')
CORS(app)  # Autoriser les requêtes cross-origin

# Chemin vers le fichier JSON
ARTWORKS_JSON_PATH = os.path.join('site', 'data', 'artworks.json')

# Chemin vers le fichier de configuration YAML
AI_CONFIG_PATH = os.path.join('ai_config.yaml')

# Clé API OpenAI (depuis variable d'environnement ou .env)
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

# Charger la configuration IA depuis le YAML
def load_ai_config():
    """Charge la configuration IA depuis le fichier YAML"""
    try:
        with open(AI_CONFIG_PATH, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    except FileNotFoundError:
        print(f"⚠️  Fichier de configuration {AI_CONFIG_PATH} non trouvé. Utilisation des valeurs par défaut.")
        return {
            'openai': {
                'model': 'gpt-4o-mini',
                'max_tokens': 2000,
                'temperature': 0.7,
                'timeout': 60
            },
            'system_prompt': 'Tu es un expert en histoire de l\'art spécialisé dans l\'analyse d\'œuvres d\'art. Tu fournis des informations détaillées, précises et enrichies. Tu réponds toujours en Markdown bien formaté.',
            'user_prompt_template': '''Tu es un expert en histoire de l'art. Fournis des informations détaillées et enrichies sur l'œuvre suivante :

Titre: {titre}
Artiste: {artiste}
Date: {date}
Musée: {musee}
{techniques}

Fournis des informations sur :
1. Le contexte historique et artistique de cette œuvre
2. L'importance de cette œuvre dans la carrière de l'artiste
3. Les techniques et innovations utilisées
4. L'influence et l'héritage de cette œuvre
5. Des détails intéressants ou des anecdotes

Réponds en français, de manière claire et structurée, en environ 500-800 mots. Utilise le format Markdown pour structurer ta réponse avec des titres, des listes, etc.'''
        }
    except yaml.YAMLError as e:
        print(f"❌ Erreur lors du chargement du fichier YAML: {e}")
        raise

# Charger la configuration au démarrage
ai_config = load_ai_config()

def load_artworks():
    """Charge le fichier artworks.json"""
    try:
        with open(ARTWORKS_JSON_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Erreur lors du chargement de artworks.json: {e}")
        return {}

def save_artworks(data):
    """Sauvegarde le fichier artworks.json"""
    try:
        # Créer une sauvegarde avant modification
        backup_path = ARTWORKS_JSON_PATH + '.backup'
        if os.path.exists(ARTWORKS_JSON_PATH):
            with open(ARTWORKS_JSON_PATH, 'r', encoding='utf-8') as f:
                backup_data = f.read()
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(backup_data)
        
        # Sauvegarder le nouveau fichier
        with open(ARTWORKS_JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return True
    except Exception as e:
        print(f"Erreur lors de la sauvegarde de artworks.json: {e}")
        return False

def find_artwork_by_id(artworks_data, artwork_id):
    """Trouve une œuvre par son ID dans la structure JSON"""
    for museum in artworks_data.values():
        if isinstance(museum, list):
            for artwork in museum:
                if artwork.get('id') == artwork_id:
                    return artwork, museum
    return None, None

@app.route('/')
def index():
    """Page d'accueil"""
    return send_from_directory('site', 'index.html')

@app.route('/images/<path:path>')
def serve_images(path):
    """Sert les images depuis le dossier images/ à la racine"""
    return send_from_directory('images', path)

@app.route('/<path:path>')
def serve_static(path):
    """Sert les fichiers statiques depuis le dossier site/"""
    return send_from_directory('site', path)

@app.route('/api/artwork/<artwork_id>/ai-info', methods=['GET', 'POST'])
def get_ai_info(artwork_id):
    """
    Endpoint pour obtenir ou générer des informations IA sur une œuvre
    
    GET: Récupère les informations existantes
    POST: Génère de nouvelles informations avec l'IA
    """
    if not OPENAI_API_KEY:
        return jsonify({
            'error': 'Clé API OpenAI non configurée. Veuillez définir OPENAI_API_KEY dans un fichier .env'
        }), 500
    
    # Charger les données
    artworks_data = load_artworks()
    artwork, museum_list = find_artwork_by_id(artworks_data, artwork_id)
    
    if not artwork:
        return jsonify({'error': 'Œuvre non trouvée'}), 404
    
    # Si GET, retourner les informations existantes
    if request.method == 'GET':
        if 'informations_ia' in artwork:
            return jsonify({
                'content': artwork['informations_ia'],
                'cached': True
            })
        return jsonify({'content': None, 'cached': False})
    
    # Si POST, générer de nouvelles informations
    try:
        # Construire le prompt à partir du template YAML
        techniques_text = ''
        if artwork.get('techniques'):
            techniques_text = f"Techniques: {', '.join(artwork.get('techniques', []))}"
        
        # Remplacer les variables dans le template
        user_prompt = ai_config['user_prompt_template'].format(
            titre=artwork.get('titre', ''),
            artiste=artwork.get('artiste', ''),
            date=artwork.get('date', ''),
            musee=artwork.get('musee', ''),
            techniques=techniques_text
        )
        
        # Récupérer la configuration OpenAI depuis le YAML
        openai_config = ai_config.get('openai', {})
        model = openai_config.get('model', 'gpt-4o-mini')
        max_tokens = openai_config.get('max_tokens', 2000)
        temperature = openai_config.get('temperature', 0.7)
        timeout = openai_config.get('timeout', 60)
        
        # Appeler l'API OpenAI
        response = requests.post(
            'https://api.openai.com/v1/chat/completions',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {OPENAI_API_KEY}'
            },
            json={
                'model': model,
                'messages': [
                    {
                        'role': 'system',
                        'content': ai_config.get('system_prompt', 'Tu es un expert en histoire de l\'art.')
                    },
                    {
                        'role': 'user',
                        'content': user_prompt
                    }
                ],
                'max_tokens': max_tokens,
                'temperature': temperature
            },
            timeout=timeout
        )
        
        if not response.ok:
            error_data = response.json() if response.content else {}
            return jsonify({
                'error': error_data.get('error', {}).get('message', f'Erreur API: {response.status_code}')
            }), response.status_code
        
        data = response.json()
        ai_content = data['choices'][0]['message']['content']
        
        # Sauvegarder dans l'œuvre
        artwork['informations_ia'] = ai_content
        
        # Sauvegarder le JSON
        if save_artworks(artworks_data):
            return jsonify({
                'content': ai_content,
                'saved': True
            })
        else:
            # Retourner quand même le contenu même si la sauvegarde a échoué
            return jsonify({
                'content': ai_content,
                'saved': False,
                'warning': 'Les informations ont été générées mais n\'ont pas pu être sauvegardées'
            })
            
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Timeout lors de l\'appel à l\'API OpenAI'}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Erreur de connexion: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Erreur inattendue: {str(e)}'}), 500

@app.route('/api/artwork/<artwork_id>/ai-info', methods=['PUT'])
def update_ai_info(artwork_id):
    """
    Endpoint pour mettre à jour manuellement les informations IA
    """
    artworks_data = load_artworks()
    artwork, museum_list = find_artwork_by_id(artworks_data, artwork_id)
    
    if not artwork:
        return jsonify({'error': 'Œuvre non trouvée'}), 404
    
    data = request.get_json()
    if 'content' not in data:
        return jsonify({'error': 'Le champ "content" est requis'}), 400
    
    artwork['informations_ia'] = data['content']
    
    if save_artworks(artworks_data):
        return jsonify({'success': True, 'message': 'Informations mises à jour'})
    else:
        return jsonify({'error': 'Erreur lors de la sauvegarde'}), 500

@app.route('/api/artwork/<artwork_id>/ce-quil-faut-voir', methods=['GET', 'POST'])
def get_ce_quil_faut_voir(artwork_id):
    """
    Endpoint pour obtenir ou générer "Ce qu'il faut voir" avec l'IA
    
    GET: Récupère les informations existantes
    POST: Génère de nouvelles informations avec l'IA
    """
    if not OPENAI_API_KEY:
        return jsonify({
            'error': 'Clé API OpenAI non configurée. Veuillez définir OPENAI_API_KEY dans un fichier .env'
        }), 500
    
    # Charger les données
    artworks_data = load_artworks()
    artwork, museum_list = find_artwork_by_id(artworks_data, artwork_id)
    
    if not artwork:
        return jsonify({'error': 'Œuvre non trouvée'}), 404
    
    # Si GET, retourner les informations existantes
    if request.method == 'GET':
        if 'ce_quil_faut_voir' in artwork and artwork['ce_quil_faut_voir']:
            return jsonify({
                'content': artwork['ce_quil_faut_voir'],
                'cached': True
            })
        return jsonify({'content': None, 'cached': False})
    
    # Si POST, générer de nouvelles informations
    try:
        # Construire le prompt à partir du template YAML
        user_prompt = ai_config.get('ce_quil_faut_voir_template', '').format(
            titre=artwork.get('titre', ''),
            artiste=artwork.get('artiste', ''),
            date=artwork.get('date', ''),
            musee=artwork.get('musee', '')
        )
        
        # Récupérer la configuration OpenAI depuis le YAML
        openai_config = ai_config.get('openai', {})
        model = openai_config.get('model', 'gpt-4o-mini')
        max_tokens = openai_config.get('max_tokens', 2000)
        temperature = openai_config.get('temperature', 0.7)
        timeout = openai_config.get('timeout', 60)
        
        # Appeler l'API OpenAI
        response = requests.post(
            'https://api.openai.com/v1/chat/completions',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {OPENAI_API_KEY}'
            },
            json={
                'model': model,
                'messages': [
                    {
                        'role': 'system',
                        'content': ai_config.get('system_prompt', 'Tu es un expert en histoire de l\'art.')
                    },
                    {
                        'role': 'user',
                        'content': user_prompt
                    }
                ],
                'max_tokens': max_tokens,
                'temperature': temperature
            },
            timeout=timeout
        )
        
        if not response.ok:
            error_data = response.json() if response.content else {}
            return jsonify({
                'error': error_data.get('error', {}).get('message', f'Erreur API: {response.status_code}')
            }), response.status_code
        
        data = response.json()
        ai_content = data['choices'][0]['message']['content']
        
        # Sauvegarder dans l'œuvre
        artwork['ce_quil_faut_voir'] = ai_content
        
        # Sauvegarder le JSON
        if save_artworks(artworks_data):
            return jsonify({
                'content': ai_content,
                'saved': True
            })
        else:
            # Retourner quand même le contenu même si la sauvegarde a échoué
            return jsonify({
                'content': ai_content,
                'saved': False,
                'warning': 'Les informations ont été générées mais n\'ont pas pu être sauvegardées'
            })
            
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Timeout lors de l\'appel à l\'API OpenAI'}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Erreur de connexion: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Erreur inattendue: {str(e)}'}), 500

if __name__ == '__main__':
    # Vérifier que la clé API est configurée
    if not OPENAI_API_KEY:
        print("⚠️  ATTENTION: OPENAI_API_KEY n'est pas définie.")
        print("   Créez un fichier .env avec: OPENAI_API_KEY=sk-...")
        print("   Le serveur démarrera mais les appels à l'IA échoueront.")
    
    # Vérifier que la configuration IA est chargée
    if ai_config:
        print("✅ Configuration IA chargée depuis ai_config.yaml")
        print(f"   Modèle: {ai_config.get('openai', {}).get('model', 'N/A')}")
    else:
        print("⚠️  Configuration IA non chargée, utilisation des valeurs par défaut")
    
    # Démarrer le serveur
    print("🚀 Démarrage du serveur Flask...")
    print(f"📁 Dossier statique: {os.path.abspath('site')}")
    print(f"📄 Fichier JSON: {os.path.abspath(ARTWORKS_JSON_PATH)}")
    print(f"⚙️  Configuration IA: {os.path.abspath(AI_CONFIG_PATH)}")
    print("🌐 Serveur disponible sur http://localhost:5000")
    
    app.run(debug=True, host='0.0.0.0', port=5000)

