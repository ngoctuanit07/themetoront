<?php 
    class Sns_Toronto_Adminhtml_ImportController extends Mage_Adminhtml_Controller_Action{ 
        public function indexAction() {
            $this->getResponse()->setRedirect($this->getUrl("adminhtml/system_config/edit/section/sns_toronto_cfg/"));
        }
        public function blocksAction() {
            $isoverwrite = Mage::helper('toronto')->getCfg('install/overwrite_blocks');
            Mage::getSingleton('toronto/import_cms')->importCms('cms/block', 'blocks', $isoverwrite);
            $this->getResponse()->setRedirect($this->getUrl("adminhtml/system_config/edit/section/sns_toronto_cfg/"));
        }
        public function pagesAction() {
            $isoverwrite = Mage::helper('toronto')->getCfg('install/overwrite_pages');
            Mage::getSingleton('toronto/import_cms')->importCms('cms/page', 'pages', $isoverwrite);
            $this->getResponse()->setRedirect($this->getUrl("adminhtml/system_config/edit/section/sns_toronto_cfg/")); 
        }
    }
    //$config = Mage::getStoreConfig('section_name/group/field'); //value
?>