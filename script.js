// Configuration Supabase
const SUPABASE_URL = "https://uthmxqncqjrdkmuvqqnk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0aG14cW5jcWpyZGttdXZxcW5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0MDEwMTEsImV4cCI6MjA3Mzk3NzAxMX0.gQtwXtyqSnoXOsJP991tM7E8uajW8MLwaOA6SF6OjGI";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Éléments DOM
const creatorSection = document.getElementById("creator-section");
const viewerSection = document.getElementById("viewer-section");
const creatorBtn = document.getElementById("show-creator");
const viewerBtn = document.getElementById("show-viewer");
const uploadForm = document.getElementById("upload-form");
const fileInput = document.getElementById("video");
const fileLabel = document.querySelector(".file-text");

// Navigation
creatorBtn.addEventListener("click", () => {
  creatorSection.classList.add("active");
  viewerSection.classList.remove("active");
  creatorBtn.classList.add("active");
  viewerBtn.classList.remove("active");
});

viewerBtn.addEventListener("click", () => {
  viewerSection.classList.add("active");
  creatorSection.classList.remove("active");
  viewerBtn.classList.add("active");
  creatorBtn.classList.remove("active");
});

// Upload de fichier
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    fileLabel.textContent = file.name;
  } else {
    fileLabel.textContent = "Choisir une vidéo";
  }
});

// Soumission du formulaire
uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const file = document.getElementById("video").files[0];

  if (!file || !title || !description) {
    alert("Veuillez remplir tous les champs");
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const btnText = submitBtn.querySelector('.btn-text');
  
  submitBtn.disabled = true;
  btnText.innerHTML = '<span class="loading-spinner"></span>Upload...';

  try {
    // Upload fichier
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { data, error } = await supabaseClient.storage
      .from("videos")
      .upload(fileName, file);

    if (error) throw error;

    // URL publique
    const { data: urlData } = supabaseClient.storage
      .from("videos")
      .getPublicUrl(data.path);

    // Sauvegarder en base
    const { error: dbError } = await supabaseClient
      .from("shorts")
      .insert([{ 
        title, 
        description, 
        url: urlData.publicUrl 
      }]);

    if (dbError) throw dbError;

    alert("Vidéo publiée !");
    uploadForm.reset();
    fileLabel.textContent = "Choisir une vidéo";
    loadVideos();
    
  } catch (err) {
    alert("Erreur: " + err.message);
  } finally {
    submitBtn.disabled = false;
    btnText.textContent = "Publier";
  }
});

// Charger les vidéos avec likes et commentaires
async function loadVideos(search = "") {
  const videosDiv = document.getElementById("videos");
  const emptyState = document.getElementById("empty-state");
  
  try {
    console.log("🔄 Rechargement des vidéos depuis la base de données...");
    
    // Requête simple pour récupérer UNIQUEMENT les vidéos existantes
    let query = supabaseClient
      .from("shorts")
      .select("*")
      .order("created_at", { ascending: false });

    if (search.trim()) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: videos, error } = await query;
    if (error) {
      console.error("❌ Erreur requête:", error);
      throw error;
    }

    console.log(`✅ ${videos?.length || 0} vidéo(s) trouvée(s) dans la base`);

    // Vider complètement la zone d'affichage
    videosDiv.innerHTML = "";
    emptyState.style.display = videos?.length === 0 ? "block" : "none";

    // Créer les cartes uniquement pour les vidéos existantes
    if (videos && videos.length > 0) {
      for (const video of videos) {
        await createVideoCard(video);
      }
    }

  } catch (err) {
    console.error("❌ Erreur chargement vidéos:", err);
    videosDiv.innerHTML = `
      <div style="text-align: center; color: #888; padding: 40px;">
        ❌ Erreur de chargement: ${err.message}
      </div>
    `;
  }
}

// Créer une carte vidéo avec interactions
async function createVideoCard(video) {
  const videosDiv = document.getElementById("videos");
  const card = document.createElement("div");
  card.className = "video-card";
  card.dataset.videoId = video.id;

  try {
    // Récupérer les compteurs séparément pour s'assurer de la fraîcheur des données
    const { data: likesData } = await supabaseClient
      .from('video_likes')
      .select('id')
      .eq('video_id', video.id);

    const { data: commentsData } = await supabaseClient
      .from('video_comments')
      .select('id')
      .eq('video_id', video.id);

    const likesCount = likesData?.length || 0;
    const commentsCount = commentsData?.length || 0;

    card.innerHTML = `
      <video src="${video.url}" controls preload="metadata" onerror="this.style.display='none'"></video>
      <div class="video-card-content">
        <h3>${escapeHtml(video.title)}</h3>
        <p>${escapeHtml(video.description)}</p>
        
        <div class="video-actions">
          <button class="action-btn like-btn" data-video-id="${video.id}">
            <span>❤️</span>
            <span class="like-count">${likesCount}</span>
          </button>
          <button class="action-btn comment-btn" data-video-id="${video.id}">
            <span>💬</span>
            <span class="comment-count">${commentsCount}</span>
          </button>
        </div>
        
        <div class="comments-section" style="display: none;">
          <div class="comment-form">
            <textarea class="comment-input" placeholder="Ajouter un commentaire..." maxlength="200"></textarea>
            <button class="comment-submit">Publier</button>
          </div>
          <div class="comments-list" data-video-id="${video.id}"></div>
        </div>
      </div>
    `;

    // Événements
    setupVideoEvents(card, video.id);
    videosDiv.appendChild(card);

  } catch (err) {
    console.error(`❌ Erreur création carte vidéo ${video.id}:`, err);
  }
}

// Fonction pour échapper le HTML (sécurité)
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// Configuration des événements pour chaque vidéo
function setupVideoEvents(card, videoId) {
  const likeBtn = card.querySelector('.like-btn');
  const commentBtn = card.querySelector('.comment-btn');
  const commentsSection = card.querySelector('.comments-section');
  const commentForm = card.querySelector('.comment-form');
  const commentInput = card.querySelector('.comment-input');
  const commentSubmit = card.querySelector('.comment-submit');

  // Toggle like
  likeBtn.addEventListener('click', async () => {
    await toggleLike(videoId, likeBtn);
  });

  // Toggle commentaires
  commentBtn.addEventListener('click', () => {
    const isVisible = commentsSection.style.display !== 'none';
    commentsSection.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
      loadComments(videoId);
    }
  });

  // Soumettre commentaire
  commentSubmit.addEventListener('click', async () => {
    await submitComment(videoId, commentInput, commentSubmit);
  });

  // Enter pour soumettre
  commentInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commentSubmit.click();
    }
  });
}

// Gérer les likes
async function toggleLike(videoId, likeBtn) {
  try {
    const { data: existingLike } = await supabaseClient
      .from('video_likes')
      .select('id')
      .eq('video_id', videoId)
      .eq('user_ip', await getUserIP())
      .single();

    if (existingLike) {
      // Supprimer le like
      await supabaseClient
        .from('video_likes')
        .delete()
        .eq('id', existingLike.id);
      
      likeBtn.classList.remove('liked');
    } else {
      // Ajouter le like
      await supabaseClient
        .from('video_likes')
        .insert([{
          video_id: videoId,
          user_ip: await getUserIP()
        }]);
      
      likeBtn.classList.add('liked');
    }

    // Mettre à jour le compteur
    const { data: likesData } = await supabaseClient
      .from('video_likes')
      .select('id')
      .eq('video_id', videoId);

    likeBtn.querySelector('.like-count').textContent = likesData?.length || 0;

  } catch (err) {
    console.error('Erreur like:', err);
  }
}

// Soumettre un commentaire
async function submitComment(videoId, input, submitBtn) {
  const text = input.value.trim();
  if (!text) return;

  submitBtn.disabled = true;
  
  try {
    await supabaseClient
      .from('video_comments')
      .insert([{
        video_id: videoId,
        text: text,
        user_ip: await getUserIP()
      }]);

    input.value = '';
    loadComments(videoId);

    // Mettre à jour le compteur
    const commentBtn = document.querySelector(`[data-video-id="${videoId}"].comment-btn`);
    const { data: commentsData } = await supabaseClient
      .from('video_comments')
      .select('id')
      .eq('video_id', videoId);

    commentBtn.querySelector('.comment-count').textContent = commentsData?.length || 0;

  } catch (err) {
    console.error('Erreur commentaire:', err);
  } finally {
    submitBtn.disabled = false;
  }
}

// Charger les commentaires
async function loadComments(videoId) {
  try {
    const { data: comments } = await supabaseClient
      .from('video_comments')
      .select('*')
      .eq('video_id', videoId)
      .order('created_at', { ascending: false })
      .limit(10);

    const commentsList = document.querySelector(`[data-video-id="${videoId}"].comments-list`);
    commentsList.innerHTML = '';

    comments?.forEach(comment => {
      const commentDiv = document.createElement('div');
      commentDiv.className = 'comment';
      commentDiv.innerHTML = `
        <div class="comment-text">${comment.text}</div>
        <div class="comment-date">${new Date(comment.created_at).toLocaleDateString('fr-FR')}</div>
      `;
      commentsList.appendChild(commentDiv);
    });

  } catch (err) {
    console.error('Erreur chargement commentaires:', err);
  }
}

// Obtenir l'IP de l'utilisateur (simple identification)
async function getUserIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return 'anonymous_' + Math.random().toString(36).substr(2, 9);
  }
}

// Recherche
let searchTimeout;
document.getElementById("search").addEventListener("input", (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadVideos(e.target.value);
  }, 300);
});

// Fonction pour forcer le rechargement
function forceReload() {
  console.log("🔄 Rechargement forcé...");
  loadVideos();
}

// Rechargement automatique toutes les 30 secondes pour rester synchronisé
setInterval(() => {
  console.log("🔄 Rechargement automatique...");
  loadVideos();
}, 30000);

// Initialisation
loadVideos();