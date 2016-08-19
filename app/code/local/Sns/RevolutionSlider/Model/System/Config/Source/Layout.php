<?php

class Sns_RevolutionSlider_Model_System_Config_Source_Layout {
	public function toOptionArray(){
		return array(
		array('value'=>'0', 'label'=>Mage::helper('revolutionslider')->__('Full width')),
		array('value'=>'1', 'label'=>Mage::helper('revolutionslider')->__('Boxed'))
		);
	}
}
