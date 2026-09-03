from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse, JsonResponse
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from .models import Note
import pickle
import base64


def signup(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('notes_home')
    else:
        form = UserCreationForm()
    return render(request, 'registration/signup.html', {'form': form})


def logout_view(request):
    logout(request)
    return redirect('login')


@login_required
def notes_home(request):
    notes = Note.objects.filter(user=request.user).order_by('-updated_at')
    return render(request, 'notes.html', {'notes': notes})


@login_required
def create_note(request):
    if request.method == 'POST':
        title = request.POST.get('title')
        content = request.POST.get('content')
        note = Note.objects.create(user=request.user, title=title, content=content)
        print(f"Note created: {note.id}")
        return JsonResponse({'status': 'success', 'id': note.id})
    return JsonResponse({'status': 'error'}, status=400)


@login_required
def list_notes(request):
    notes = Note.objects.filter(user=request.user)
    return JsonResponse({'notes': list(notes.values())})


@login_required
def get_note(request, note_id):
    note = get_object_or_404(Note, id=note_id, user=request.user)
    return JsonResponse({'note': {'title': note.title, 'content': note.content}})


@login_required
def update_note(request, note_id):
    note = get_object_or_404(Note, id=note_id, user=request.user)
    if request.method == 'POST':
        note.title = request.POST.get('title', note.title)
        note.content = request.POST.get('content', note.content)
        note.save()
        return JsonResponse({'status': 'success'})
    return JsonResponse({'status': 'error'}, status=400)


@login_required
def delete_note(request, note_id):
    note = get_object_or_404(Note, id=note_id, user=request.user)
    note.delete()
    return JsonResponse({'status': 'success'})


@login_required
def export_notes(request):
    notes = Note.objects.filter(user=request.user)
    serialized = pickle.dumps(list(notes.values()))
    return HttpResponse(base64.b64encode(serialized), content_type='text/plain')


@login_required
def import_notes(request):
    if request.method == 'POST':
        try:
            data = base64.b64decode(request.FILES['import_file'].read())
            notes_data = pickle.loads(data)
            for note_data in notes_data:
                Note.objects.create(
                    user=request.user,
                    title=note_data['title'],
                    content=note_data['content']
                )
            return JsonResponse({'status': 'success'})
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
    return JsonResponse({'status': 'error'}, status=400)
