import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

interface Message {
  sender: 'user' | 'bot';
  text: string;
  time: Date;
  isHtml?: boolean;
}

type ChatMode = 'chat' | 'wizard';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.html',
  styleUrl: './chatbot.scss'
})
export class ChatbotComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private router = inject(Router);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  isOpen = false;
  messages: Message[] = [];
  userInput = '';
  isTyping = false;
  
  currentUser: any = null;
  isVisible = false;

  // ── Wizard / Questionnaire State ──
  mode: ChatMode = 'chat';
  wizardStep = 0; // 0 = not started, 1 = aim, 2 = diet, 3 = budget, 4 = notes
  answers = {
    aim: '',
    diet: '',
    budget: '',
    notes: ''
  };

  ngOnInit() {
    this.checkVisibility();
    
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.checkVisibility();
    });

    this.auth.getCurrentUser().subscribe({
      next: (user) => {
        this.currentUser = user;
        this.checkVisibility();
      },
      error: () => {
        this.currentUser = null;
        this.checkVisibility();
      }
    });
  }

  checkVisibility() {
    const isLoggedIn = this.auth.isLoggedIn();
    if (!isLoggedIn) {
      this.isVisible = false;
      return;
    }

    const currentUrl = this.router.url.split('?')[0];
    const isDriver = currentUrl.startsWith('/driver');
    const allowedCustomerRoutes = ['/dashboard', '/plans', '/profile'];
    const isAllowedRoute = allowedCustomerRoutes.some(r => currentUrl === r || currentUrl.startsWith(r + '/'));
    
    this.isVisible = !isDriver && (isAllowedRoute || this.currentUser?.role?.toLowerCase() === 'admin');
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    if (this.isOpen && this.messages.length === 0) {
      this.showWelcomeOptions();
    }
    this.scrollToBottom();
  }

  showWelcomeOptions() {
    this.mode = 'chat';
    this.wizardStep = 0;
    this.messages.push({
      sender: 'bot',
      text: `Hi ${this.currentUser?.full_name?.split(' ')[0] || 'there'}! 👋 Welcome to Nutribox Support.\n\nHow would you like to proceed? Click "Find My Ideal Plan" to answer a few quick questions and get plan recommendations, or select "Just Ask" to type a custom question.`,
      time: new Date()
    });
  }

  startWizard() {
    this.mode = 'wizard';
    this.wizardStep = 1;
    this.answers = { aim: '', diet: '', budget: '', notes: '' };
    
    this.messages.push({
      sender: 'bot',
      text: `🤖 Plan Finder Wizard Started!\n\n**Step 1:** What is your primary fitness goal?`,
      time: new Date()
    });
    this.scrollToBottom();
  }

  selectAim(aim: string) {
    this.answers.aim = aim;
    this.messages.push({
      sender: 'user',
      text: aim === 'skip' ? 'Skip goal selection' : `My goal is: ${this.formatLabel(aim)}`,
      time: new Date()
    });
    
    this.wizardStep = 2;
    this.messages.push({
      sender: 'bot',
      text: `**Step 2:** What are your dietary preferences?`,
      time: new Date()
    });
    this.scrollToBottom();
  }

  selectDiet(diet: string) {
    this.answers.diet = diet;
    this.messages.push({
      sender: 'user',
      text: diet === 'skip' ? 'Skip diet preference' : `Diet: ${this.formatLabel(diet)}`,
      time: new Date()
    });
    
    this.wizardStep = 3;
    this.messages.push({
      sender: 'bot',
      text: `**Step 3:** What is your weekly budget range?`,
      time: new Date()
    });
    this.scrollToBottom();
  }

  selectBudget(budget: string) {
    this.answers.budget = budget;
    this.messages.push({
      sender: 'user',
      text: budget === 'skip' ? 'Skip budget preference' : `Budget: ${this.formatLabel(budget)}`,
      time: new Date()
    });
    
    this.wizardStep = 4;
    this.messages.push({
      sender: 'bot',
      text: `**Step 4:** Any favorites or custom requests? (e.g. no gluten, extra protein, extra veggies). Select an option, type your note below, or click Skip.`,
      time: new Date()
    });
    this.scrollToBottom();
  }

  selectFavoriteOption(fav: string) {
    this.userInput = fav;
    this.submitWizardNotes(false);
  }

  submitWizardNotes(skip = false) {
    this.answers.notes = skip ? '' : this.userInput.trim();
    this.userInput = '';
    
    this.messages.push({
      sender: 'user',
      text: skip ? 'Skip notes' : `My notes: ${this.answers.notes}`,
      time: new Date()
    });
    
    this.isTyping = true;
    this.wizardStep = 0;
    this.mode = 'chat'; // return to chat mode to display response and allow follow-ups
    
    this.scrollToBottom();

    // Construct structured query for RAG model
    const structuredQuery = 
      `Recommend the best subscription plans/options based strictly on the provided PDF context for a user with the following profile:\n` +
      `- Goal: ${this.answers.aim ? this.formatLabel(this.answers.aim) : 'Not specified (skipped)'}\n` +
      `- Diet: ${this.answers.diet ? this.formatLabel(this.answers.diet) : 'Not specified (skipped)'}\n` +
      `- Weekly Budget: ${this.answers.budget ? this.formatLabel(this.answers.budget) : 'Not specified (skipped)'}\n` +
      `- Preferences/Custom Requests: ${this.answers.notes || 'None (skipped)'}\n\n` +
      `Provide a direct recommendation list including specific tier names and matching delivery slots.`;

    this.http.post<any>(`${environment.apiBaseUrl}/api/chatbot/query`, {
      question: structuredQuery
    }).subscribe({
      next: (res) => {
        this.isTyping = false;
        this.messages.push({
          sender: 'bot',
          text: res.answer || "I parsed your choices but couldn't load suggestions from the policies. Please contact WhatsApp support.",
          time: new Date()
        });
        this.scrollToBottom();
      },
      error: (err) => {
        this.isTyping = false;
        const errMsg = err.error?.detail || "Connection lost. Please try again shortly.";
        this.messages.push({
          sender: 'bot',
          text: `Oops! We had an issue matching plans: ${errMsg}`,
          time: new Date()
        });
        this.scrollToBottom();
      }
    });
  }

  selectFreeChat() {
    this.mode = 'chat';
    this.wizardStep = 0;
    this.messages.push({
      sender: 'user',
      text: `Just Ask a Question`,
      time: new Date()
    });
    this.messages.push({
      sender: 'bot',
      text: `Sure! Ask me any custom question about Nutribox policies, pricing, or subscription schedules.`,
      time: new Date()
    });
    this.scrollToBottom();
  }

  resetChat() {
    this.messages = [];
    this.showWelcomeOptions();
    this.scrollToBottom();
  }

  sendMessage() {
    if (this.mode === 'wizard' && this.wizardStep === 4) {
      this.submitWizardNotes(false);
      return;
    }

    if (!this.userInput.trim() || this.isTyping) return;

    const query = this.userInput.trim();
    this.userInput = '';

    this.messages.push({
      sender: 'user',
      text: query,
      time: new Date()
    });
    this.scrollToBottom();

    this.isTyping = true;

    this.http.post<any>(`${environment.apiBaseUrl}/api/chatbot/query`, {
      question: query
    }).subscribe({
      next: (res) => {
        this.isTyping = false;
        this.messages.push({
          sender: 'bot',
          text: res.answer || "I'm sorry, I couldn't compute a response right now.",
          time: new Date()
        });
        this.scrollToBottom();
      },
      error: (err) => {
        this.isTyping = false;
        const errMsg = err.error?.detail || "Connection lost. Please try again shortly.";
        this.messages.push({
          sender: 'bot',
          text: `Oops! ${errMsg}`,
          time: new Date()
        });
        this.scrollToBottom();
      }
    });
  }

  formatLabel(val: string): string {
    const map: Record<string, string> = {
      'weight_loss': 'Weight Loss 📉',
      'weight_gain': 'Weight Gain 📈',
      'maintain': 'Maintain Weight ⚖️',
      'veg': 'Vegetarian 🌿',
      'nonveg': 'Non-Vegetarian 🍖',
      'both': 'Both (Veg & Non-Veg) 🍽️',
      'under_1000': 'Under ₹1000',
      '1000_2000': '₹1000 - ₹2000',
      'over_2000': 'Over ₹2000'
    };
    return map[val] || val;
  }

  private scrollToBottom(): void {
    try {
      setTimeout(() => {
        if (this.scrollContainer) {
          this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
        }
      }, 80);
    } catch (err) {}
  }
}
