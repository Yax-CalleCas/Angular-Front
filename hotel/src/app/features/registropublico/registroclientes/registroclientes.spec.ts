import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Registroclientes } from './registroclientes';

describe('Registroclientes', () => {
  let component: Registroclientes;
  let fixture: ComponentFixture<Registroclientes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Registroclientes],
    }).compileComponents();

    fixture = TestBed.createComponent(Registroclientes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
