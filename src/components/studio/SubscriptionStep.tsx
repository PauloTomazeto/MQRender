import React from 'react';
import { motion } from 'motion/react';
import { Zap, Star, Building2, Check, Mail, ImagePlus } from 'lucide-react';
import { Button, Card, Badge } from '../UI';

export function SubscriptionStep() {
  return (
    <motion.div
      key="subscription"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto py-12"
    >
      <div className="text-center mb-16">
        <Badge className="mb-4">Planos & Assinaturas</Badge>
        <h1 className="text-5xl font-display font-bold text-bluegray mb-6 tracking-tight">
          Escolha o seu <span className="text-gold">Plano</span>
        </h1>
        <p className="text-bluegray/60 text-lg max-w-xl mx-auto leading-relaxed">
          Potencialize seu workflow com ferramentas avançadas de IA para fotografia arquitetural.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Basic Plan */}
        <Card className="p-8 flex flex-col relative overflow-hidden">
          <div className="space-y-6 flex-1">
            <div className="w-12 h-12 rounded-xl bg-bluegray/5 flex items-center justify-center">
              <Zap className="w-6 h-6 text-bluegray/40" />
            </div>
            <div>
              <h3 className="text-2xl font-display font-bold text-bluegray">Basic</h3>
              <p className="text-sm text-bluegray/60">Ideal para iniciantes no Studio.</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-bluegray">$157.99</span>
              <span className="text-xs font-bold text-bluegray/40 uppercase tracking-widest">
                /mês
              </span>
            </div>
            <ul className="space-y-4">
              {[
                'Geração de Prompts Ilimitada',
                'Escaneamento de Imagens (Scan)',
                'Acesso ao M&Q Move (Base)',
                'Suporte via Comunidade',
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-bluegray/70">
                  <Check className="w-4 h-4 text-emerald-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <Button variant="outline" className="mt-8 w-full py-6">
            Assinar Agora
          </Button>
        </Card>

        {/* Premium Plan */}
        <Card className="p-8 flex flex-col relative overflow-hidden border-gold/40 shadow-2xl scale-105 z-10 bg-white">
          <div className="absolute top-0 right-0 gold-gradient px-4 py-1 text-[10px] font-black text-white uppercase tracking-widest rounded-bl-xl">
            Popular
          </div>
          <div className="space-y-6 flex-1">
            <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center">
              <Star className="w-6 h-6 text-gold" />
            </div>
            <div>
              <h3 className="text-2xl font-display font-bold text-bluegray">Premium</h3>
              <p className="text-sm text-bluegray/60">Para profissionais de alto nível.</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-bluegray">$199</span>
              <span className="text-xs font-bold text-bluegray/40 uppercase tracking-widest">
                /mês
              </span>
            </div>
            <ul className="space-y-4">
              {[
                'Tudo do plano Basic',
                '100 Imagens Geradas por Mês',
                'Prioridade no Processamento',
                'Suporte Prioritário',
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-bluegray/70">
                  <Check className="w-4 h-4 text-gold" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <Button variant="gold" className="mt-8 w-full py-6">
            Assinar Agora
          </Button>
        </Card>

        {/* Enterprise Plan */}
        <Card className="p-8 flex flex-col relative overflow-hidden">
          <div className="space-y-6 flex-1">
            <div className="w-12 h-12 rounded-xl bg-bluegray/5 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-bluegray/40" />
            </div>
            <div>
              <h3 className="text-2xl font-display font-bold text-bluegray">Enterprise</h3>
              <p className="text-sm text-bluegray/60">Para empresas com alta demanda.</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-bluegray">Sob Consulta</span>
            </div>
            <ul className="space-y-4">
              {[
                'Tudo do plano Premium',
                'Cota de Imagens Customizada',
                'Gerente de Conta Dedicado',
                'Treinamento para Equipes',
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-bluegray/70">
                  <Check className="w-4 h-4 text-bluegray/40" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <Button
            variant="outline"
            className="mt-8 w-full py-6 flex items-center justify-center gap-2"
          >
            <Mail className="w-4 h-4" />
            Fale Conosco
          </Button>
        </Card>
      </div>

      {/* Quota Packages */}
      <div className="mt-20 max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-display font-bold text-bluegray">
            Precisa de mais imagens?
          </h2>
          <p className="text-sm text-bluegray/60">Disponível para todos os planos.</p>
        </div>
        <Card className="p-8 bg-offwhite border-none flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center">
              <ImagePlus className="w-8 h-8 text-gold" />
            </div>
            <div>
              <h4 className="text-xl font-bold text-bluegray">Pacote de 100 Imagens</h4>
              <p className="text-sm text-bluegray/60">
                Adicione créditos extras à sua conta instantaneamente.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-2xl font-black text-bluegray">$59.99</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40">
                Pagamento Único
              </p>
            </div>
            <Button variant="gold" className="px-8">
              Comprar Créditos
            </Button>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
