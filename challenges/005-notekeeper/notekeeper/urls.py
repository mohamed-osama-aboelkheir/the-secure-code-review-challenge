"""
URL configuration for the Notekeeper project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
"""
from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import path

from notes import views

urlpatterns = [
    path('admin/', admin.site.urls),

    # Authentication
    path('accounts/login/', auth_views.LoginView.as_view(), name='login'),
    path('accounts/logout/', views.logout_view, name='logout'),
    path('accounts/signup/', views.signup, name='signup'),

    # Web page
    path('', views.notes_home, name='notes_home'),

    # Notes CRUD URLs
    path('create_note/', views.create_note, name='create_note'),
    path('list_notes/', views.list_notes, name='list_notes'),
    path('get_note/<str:note_id>/', views.get_note, name='get_note'),
    path('update_note/<str:note_id>/', views.update_note, name='update_note'),
    path('delete_note/<str:note_id>/', views.delete_note, name='delete_note'),

    # Import/Export URLs
    path('export_notes/', views.export_notes, name='export_notes'),
    path('import_notes/', views.import_notes, name='import_notes'),
]
