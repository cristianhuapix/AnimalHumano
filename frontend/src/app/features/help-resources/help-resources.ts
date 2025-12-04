import { Component, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule } from '@angular/router';

interface Resource {
  title: string;
  description: string;
  url: string;
  icon: string;
  source: string;
}

@Component({
  selector: 'app-help-resources',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './help-resources.html',
  styleUrl: './help-resources.scss'
})
export class HelpResourcesComponent {
  private location = inject(Location);

  resources: Resource[] = [
    {
      title: 'Cómo viajar al exterior con perros y gatos',
      description: 'Guía oficial del procedimiento para obtener el Certificado Veterinario Internacional (CVI) del Senasa para viajar con tu mascota.',
      url: 'https://www.argentina.gob.ar/procedimiento-para-viajar-al-exterior-con-perros-y-gatos',
      icon: '✈️',
      source: 'Argentina.gob.ar'
    },
    {
      title: 'Costo del trámite CVI',
      description: 'Información sobre las tarifas para obtener el Certificado Veterinario Internacional: trámite normal, urgente, digital y muy urgente.',
      url: 'https://www.argentina.gob.ar/senasa/costo-del-tramite',
      icon: '💰',
      source: 'Argentina.gob.ar'
    },
    {
      title: 'Documentación para viajar con mascotas a Uruguay',
      description: 'Requisitos específicos para viajar con perros y gatos a Uruguay: certificados, vacunas, antiparasitarios y microchip.',
      url: 'https://www.argentina.gob.ar/noticias/la-documentacion-que-se-necesita-para-viajar-con-mascotas-al-uruguay',
      icon: '🇺🇾',
      source: 'Argentina.gob.ar'
    },
    {
      title: 'Tutorial: Cómo viajar con tu mascota',
      description: 'Video explicativo con consejos y pasos para viajar con tu mascota de forma segura.',
      url: 'https://www.youtube.com/watch?v=TmZnYYb3VrQ',
      icon: '🎬',
      source: 'YouTube'
    },
    {
      title: 'Consejos para dueños de mascotas',
      description: 'Contenido útil sobre el cuidado responsable de mascotas.',
      url: 'https://www.instagram.com/reel/DBzPSR_P_RB/',
      icon: '📱',
      source: 'Instagram'
    }
  ];

  goBack(): void {
    this.location.back();
  }

  openResource(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
