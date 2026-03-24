import React from 'react';
import { Shield, Lock, Eye, Server, Database } from 'lucide-react';

const PrivacyPolicyPage = () => {
    return (
        <div className="terms-page">
            <div className="container">
                <div className="terms-header mb-12 text-center">
                    <div className="terms-icon-wrapper mx-auto mb-6">
                        <Shield size={48} className="text-primary" />
                    </div>
                    <h1 className="terms-title text-4xl font-bold mb-4">Privacy Policy</h1>
                    <p className="terms-subtitle text-gray-400">Effective Date: October 1, 2024</p>
                </div>

                <div className="terms-content glass-card max-w-4xl mx-auto p-10">
                    <section className="mb-10">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-3"><Eye className="text-primary"/> 1. Information We Collect</h2>
                        <p className="text-gray-300 mb-4 leading-relaxed">
                            We collect information when you register on our site, place an order, subscribe to our newsletter, respond to a survey, or fill out a form. The data collected includes:
                        </p>
                        <ul className="list-disc pl-8 space-y-2 text-gray-400">
                            <li>Name and Email address for account creation.</li>
                            <li>The prompts and requirements you type into the Generator, which are processed to create your tests.</li>
                            <li>Browser, device, and analytics footprint (IP, OS).</li>
                        </ul>
                    </section>
                    
                    <section className="mb-10">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-3"><Database className="text-purple-400"/> 2. How We Use Your Data</h2>
                        <p className="text-gray-300 mb-4 leading-relaxed">
                            Any of the information we collect from you may be used in one of the following ways:
                        </p>
                        <ul className="list-disc pl-8 space-y-2 text-gray-400">
                            <li><strong>To personalize your experience:</strong> (your information helps us to better respond to your individual needs)</li>
                            <li><strong>To improve our website:</strong> (we continually strive to improve our website offerings based on the information and feedback we receive from you)</li>
                            <li><strong>To improve AI Models:</strong> We DO NOT use your private proprietary prompt data to train the core foundation models unless you explicitly opt in.</li>
                            <li><strong>To send periodic emails:</strong> The email address you provide may be used to send you information and updates pertaining to your subscription.</li>
                        </ul>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-3"><Lock className="text-amber-400"/> 3. Data Secuity</h2>
                        <p className="text-gray-300 mb-4 leading-relaxed">
                            We implement a variety of security measures to maintain the safety of your personal information when you enter, submit, or access your personal information. All supplied sensitive/credit information is transmitted via Secure Socket Layer (SSL) technology and then encrypted into our Payment gateway providers database only to be accessible by those authorized with special access rights to such systems, and are required to keep the information confidential.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-3"><Server className="text-green-400"/> 4. Third-Party Relationships</h2>
                        <p className="text-gray-300 mb-4 leading-relaxed">
                            We do not sell, trade, or otherwise transfer to outside parties your personally identifiable information. This does not include trusted third parties who assist us in operating our website, conducting our business, or servicing you, so long as those parties agree to keep this information confidential. For example, test generations may be processed by OpenAI APIs.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicyPage;
